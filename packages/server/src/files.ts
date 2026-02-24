/**
 * Channel-agnostic file download, storage, and prompt construction utilities.
 *
 * Downloads files from platform-specific URLs (Slack url_private, WhatsApp media)
 * and saves them to the user's workspace. Slack requires Bearer auth on the initial
 * request but redirects to CDN pre-signed URLs — auth must be stripped on redirect
 * to avoid leaking the token to external hosts. WhatsApp uses Baileys'
 * downloadMediaMessage which handles decryption internally.
 *
 * Image attachments are detected by MIME type and can be split from non-images for
 * multimodal prompt construction (base64 ImageBlockParam for native vision).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type WASocket, downloadMediaMessage, getContentType, type proto } from "@whiskeysockets/baileys";
import type { Logger } from "./logger";

export interface Attachment {
	originalName: string;
	mimeType: string;
	localPath: string;
	sizeBytes: number;
}

function sanitizeFilename(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Downloads a file from Slack's url_private with Bearer auth.
 * Follows redirects manually to strip auth header on CDN hops —
 * Slack redirects to pre-signed CDN URLs that reject the Bearer token.
 */
export async function downloadSlackFile(
	url: string,
	botToken: string,
	destDir: string,
	maxSizeBytes: number,
	logger?: Logger,
): Promise<Attachment> {
	await mkdir(destDir, { recursive: true });
	logger?.debug({ url, destDir, maxSizeBytes }, "Starting file download");

	let currentUrl = url;
	let response: Response | null = null;
	const maxRedirects = 5;

	for (let i = 0; i <= maxRedirects; i++) {
		const hostname = new URL(currentUrl).hostname;
		const isSlackHost = hostname.endsWith("slack.com");
		const headers: Record<string, string> = {};
		if (isSlackHost) {
			headers.Authorization = `Bearer ${botToken}`;
		}

		logger?.debug({ hop: i, hostname, isSlackHost, hasAuth: isSlackHost }, "Fetching URL");
		response = await fetch(currentUrl, { headers, redirect: "manual" });
		logger?.debug(
			{ hop: i, status: response.status, contentType: response.headers.get("content-type") },
			"Response received",
		);

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) throw new Error("Redirect without Location header");
			logger?.debug({ hop: i, redirectTo: location }, "Following redirect");
			currentUrl = location;
			continue;
		}

		break;
	}

	if (!response || !response.ok) {
		logger?.warn({ status: response?.status, url }, "File download failed");
		throw new Error(`Download failed: HTTP ${response?.status ?? "no response"}`);
	}

	const contentLength = Number(response.headers.get("content-length") || 0);
	if (contentLength > maxSizeBytes) {
		throw new Error(`File too large: ${contentLength} bytes exceeds ${maxSizeBytes} byte limit`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length > maxSizeBytes) {
		throw new Error(`File too large: ${buffer.length} bytes exceeds ${maxSizeBytes} byte limit`);
	}

	const mimeType = response.headers.get("content-type") || "application/octet-stream";
	const originalName = basename(url.split("?")[0]) || "file";
	const filename = `${Date.now()}_${sanitizeFilename(originalName)}`;
	const localPath = join(destDir, filename);

	await writeFile(localPath, buffer);

	logger?.debug({ originalName, mimeType, sizeBytes: buffer.length, localPath }, "File downloaded successfully");

	return {
		originalName,
		mimeType,
		localPath,
		sizeBytes: buffer.length,
	};
}

/**
 * Formats an array of attachments as an XML block to append to the agent prompt.
 * Returns empty string if no attachments.
 */
export function formatAttachmentsForPrompt(attachments: Attachment[]): string {
	if (!attachments.length) return "";
	const files = attachments
		.map((a) => `<file name="${a.originalName}" path="${a.localPath}" mime="${a.mimeType}" size="${a.sizeBytes}" />`)
		.join("\n");
	return `\n\n<attachments>\n${files}\n</attachments>`;
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type ContentBlock =
	| { type: "text"; text: string }
	| { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } };

export function isImageAttachment(attachment: Attachment): boolean {
	return IMAGE_MIME_TYPES.has(attachment.mimeType);
}

export function splitAttachments(attachments: Attachment[]): { images: Attachment[]; nonImages: Attachment[] } {
	const images: Attachment[] = [];
	const nonImages: Attachment[] = [];
	for (const a of attachments) {
		(isImageAttachment(a) ? images : nonImages).push(a);
	}
	return { images, nonImages };
}

/**
 * Builds a multimodal content array for the SDK's SDKUserMessage.message.content.
 * Text prompt + non-image attachment XML go into a text block. Each image attachment
 * becomes a base64 ImageBlockParam for native Claude vision.
 */
export async function buildMultimodalContent(textPrompt: string, attachments: Attachment[]): Promise<ContentBlock[]> {
	const { images, nonImages } = splitAttachments(attachments);
	const blocks: ContentBlock[] = [];

	const text = textPrompt + formatAttachmentsForPrompt(nonImages);
	blocks.push({ type: "text", text });

	for (const img of images) {
		const data = await readFile(img.localPath);
		blocks.push({
			type: "image",
			source: {
				type: "base64",
				media_type: img.mimeType as ImageMediaType,
				data: data.toString("base64"),
			},
		});
	}

	return blocks;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"video/mp4": "mp4",
	"audio/ogg; codecs=opus": "ogg",
	"audio/mp4": "m4a",
	"audio/mpeg": "mp3",
	"application/pdf": "pdf",
};

export function mimeToExtension(mime: string | undefined | null): string {
	if (!mime) return "bin";
	return MIME_EXTENSION_MAP[mime] ?? "bin";
}

const EXTENSION_MIME_MAP: Record<string, string> = Object.fromEntries(
	Object.entries(MIME_EXTENSION_MAP).map(([mime, ext]) => [ext, mime]),
);

export function extensionToMime(ext: string): string {
	return EXTENSION_MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

/**
 * Downloads media from a WhatsApp message using Baileys' built-in decryption.
 * Saves to destDir with a timestamped sanitized filename.
 */
export async function downloadWhatsAppMedia(
	msg: proto.IWebMessageInfo,
	sock: WASocket,
	destDir: string,
	maxSizeBytes: number,
	logger?: Logger,
): Promise<Attachment> {
	await mkdir(destDir, { recursive: true });

	const buffer = await downloadMediaMessage(
		msg as Parameters<typeof downloadMediaMessage>[0],
		"buffer",
		{},
		{
			reuploadRequest: sock.updateMediaMessage,
			logger: logger as never,
		},
	);

	if (buffer.length > maxSizeBytes) {
		throw new Error(`File exceeds ${Math.round(maxSizeBytes / (1024 * 1024))}MB limit`);
	}

	const messageType = getContentType(msg.message ?? undefined);
	const mediaMsg = msg.message?.[messageType as keyof typeof msg.message] as
		| { mimetype?: string; fileName?: string }
		| undefined;
	const mimeType: string = mediaMsg?.mimetype ?? "application/octet-stream";
	const originalName: string = mediaMsg?.fileName ?? `${Date.now()}.${mimeToExtension(mimeType)}`;

	const sanitized = sanitizeFilename(originalName);
	const fileName = `${Date.now()}_${sanitized}`;
	const localPath = join(destDir, fileName);

	await writeFile(localPath, buffer);

	logger?.debug(
		{ originalName: sanitized, mimeType, sizeBytes: buffer.length, localPath },
		"WhatsApp media downloaded",
	);

	return {
		originalName: sanitized,
		mimeType,
		localPath,
		sizeBytes: buffer.length,
	};
}
