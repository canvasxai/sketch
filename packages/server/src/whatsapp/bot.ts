import type { Boom } from "@hapi/boom";
/**
 * WhatsApp adapter using Baileys — connection management, message handling,
 * reconnection with exponential backoff, thinking indicators, echo detection.
 *
 * DMs only (messages from @s.whatsapp.net JIDs). Groups filtered out.
 * Auth state persisted in DB via createDbAuthState.
 */
import {
	DisconnectReason,
	type WASocket,
	type WAVersion,
	fetchLatestBaileysVersion,
	getContentType,
	makeWASocket,
	type proto,
} from "@whiskeysockets/baileys";
import type { Kysely } from "kysely";
import type { DB } from "../db/schema";
import type { Logger } from "../logger";
import { createDbAuthState } from "./auth-store";
import { chunkText } from "./chunking";

const THINKING_EMOJIS = ["⏳", "🧠", "🤔", "💭", "⚡", "✨", "🔮"];
const ECHO_TTL_MS = 60_000;
const WATCHDOG_INTERVAL_MS = 60_000;
const WATCHDOG_STALE_MS = 30 * 60_000;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_FACTOR = 1.8;
const RECONNECT_JITTER = 0.25;

/** Cached WA version — fetched once from GitHub, reused for all subsequent connections. */
let cachedVersion: WAVersion | null = null;

async function getWaVersion(): Promise<WAVersion | undefined> {
	if (cachedVersion) return cachedVersion;
	const { version } = await fetchLatestBaileysVersion();
	cachedVersion = version as WAVersion;
	return version;
}

export interface WhatsAppMessage {
	text: string;
	phoneNumber: string;
	jid: string;
	messageId: string;
	pushName: string;
	rawMessage: proto.IWebMessageInfo;
	mediaType?: string;
}

export type WhatsAppMessageHandler = (message: WhatsAppMessage) => Promise<void>;

export interface WhatsAppBotConfig {
	db: Kysely<DB>;
	logger: Logger;
}

export class WhatsAppBot {
	private db: Kysely<DB>;
	private logger: Logger;
	private sock: WASocket | null = null;
	private handler: WhatsAppMessageHandler | null = null;
	private recentlySent = new Set<string>();
	private reconnectAttempt = 0;
	private watchdogTimer: ReturnType<typeof setInterval> | null = null;
	private lastMessageAt = 0;

	constructor(config: WhatsAppBotConfig) {
		this.db = config.db;
		this.logger = config.logger;
	}

	onMessage(handler: WhatsAppMessageHandler): void {
		this.handler = handler;
	}

	/**
	 * Check if WhatsApp creds exist in DB.
	 * If yes, connect automatically. If no, skip — wait for /whatsapp/pair.
	 * Returns true if connected, false if waiting for pairing.
	 */
	async start(): Promise<boolean> {
		const row = await this.db.selectFrom("whatsapp_creds").select("id").where("id", "=", "default").executeTakeFirst();

		if (!row) {
			this.logger.info("No WhatsApp creds in DB — waiting for pairing");
			return false;
		}

		await this.createSocket();
		return true;
	}

	/**
	 * Start a fresh pairing session. Returns QR string via callback.
	 * Called from /whatsapp/pair endpoint.
	 */
	async startPairing(onQr: (qr: string) => void): Promise<void> {
		if (this.sock) {
			this.sock.end(undefined);
			this.sock = null;
		}
		this.stopWatchdog();

		const authState = await createDbAuthState(this.db, this.logger);
		const version = await getWaVersion();

		this.sock = makeWASocket({
			version: version as WAVersion,
			auth: {
				creds: authState.state.creds,
				keys: authState.state.keys,
			},
			logger: this.logger as unknown as Parameters<typeof makeWASocket>[0]["logger"],
			printQRInTerminal: false,
			syncFullHistory: false,
			markOnlineOnConnect: false,
		});

		this.sock.ev.on("creds.update", authState.saveCreds);

		this.sock.ev.on("connection.update", async (update) => {
			const { connection, lastDisconnect, qr } = update;

			if (qr) {
				onQr(qr);
			}

			if (connection === "open") {
				this.logger.info("WhatsApp connected after pairing");
				this.reconnectAttempt = 0;
				this.registerMessageHandler();
				this.startWatchdog();
			}

			if (connection === "close") {
				const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
				const errorMsg = lastDisconnect?.error?.message ?? "";

				// Code 515 = restart required after successful pairing
				if (statusCode === DisconnectReason.restartRequired) {
					this.logger.info("WhatsApp restart required after pairing — reconnecting");
					await this.createSocket();
					return;
				}

				if (statusCode === DisconnectReason.loggedOut) {
					this.logger.warn("WhatsApp logged out during pairing");
					await authState.clearCreds();
					this.stopWatchdog();
					return;
				}

				// QR expired without being scanned — clean up silently
				if (errorMsg.includes("QR refs")) {
					this.logger.info("WhatsApp QR expired — call /whatsapp/pair again to retry");
					this.sock?.end(undefined);
					this.sock = null;
					return;
				}

				this.logger.info({ statusCode, error: errorMsg }, "WhatsApp disconnected during pairing");
				this.sock?.end(undefined);
				this.sock = null;
			}
		});
	}

	async stop(): Promise<void> {
		this.stopWatchdog();
		if (this.sock) {
			this.sock.end(undefined);
			this.sock = null;
		}
	}

	get isConnected(): boolean {
		return this.sock?.user !== undefined;
	}

	get socket(): WASocket | null {
		return this.sock;
	}

	// --- Sending ---

	async sendText(jid: string, text: string): Promise<void> {
		if (!this.sock) return;
		const chunks = chunkText(text);
		for (const chunk of chunks) {
			const sent = await this.sock.sendMessage(jid, { text: chunk });
			if (sent?.key?.id) this.trackSentMessage(sent.key.id);
		}
	}

	async sendFile(jid: string, filePath: string, mimeType: string, fileName: string): Promise<void> {
		if (!this.sock) return;
		const isImage = mimeType.startsWith("image/");

		if (isImage) {
			const sent = await this.sock.sendMessage(jid, {
				image: { url: filePath },
				caption: fileName,
			});
			if (sent?.key?.id) this.trackSentMessage(sent.key.id);
		} else {
			const sent = await this.sock.sendMessage(jid, {
				document: { url: filePath },
				mimetype: mimeType,
				fileName,
			});
			if (sent?.key?.id) this.trackSentMessage(sent.key.id);
		}
	}

	async reactThinking(jid: string, key: proto.IMessageKey): Promise<void> {
		if (!this.sock) return;
		const emoji = THINKING_EMOJIS[Math.floor(Math.random() * THINKING_EMOJIS.length)];
		await this.sock.sendMessage(jid, { react: { text: emoji, key } });
	}

	async removeReaction(jid: string, key: proto.IMessageKey): Promise<void> {
		if (!this.sock) return;
		await this.sock.sendMessage(jid, { react: { text: "", key } });
	}

	async sendComposing(jid: string): Promise<void> {
		if (!this.sock) return;
		await this.sock.sendPresenceUpdate("composing", jid);
	}

	// --- Internal ---

	private async createSocket(): Promise<void> {
		const authState = await createDbAuthState(this.db, this.logger);
		const version = await getWaVersion();

		this.sock = makeWASocket({
			version: version as WAVersion,
			auth: {
				creds: authState.state.creds,
				keys: authState.state.keys,
			},
			logger: this.logger as unknown as Parameters<typeof makeWASocket>[0]["logger"],
			printQRInTerminal: false,
			syncFullHistory: false,
			markOnlineOnConnect: false,
		});

		this.sock.ev.on("creds.update", authState.saveCreds);
		this.registerConnectionHandler(authState);
		this.registerMessageHandler();
		this.startWatchdog();
	}

	private registerConnectionHandler(authState: Awaited<ReturnType<typeof createDbAuthState>>): void {
		this.sock?.ev.on("connection.update", async (update) => {
			const { connection, lastDisconnect } = update;

			if (connection === "open") {
				this.logger.info("WhatsApp connected");
				this.reconnectAttempt = 0;
			}

			if (connection === "close") {
				const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

				if (statusCode === DisconnectReason.loggedOut) {
					this.logger.warn("WhatsApp logged out — clearing credentials");
					await authState.clearCreds();
					this.stopWatchdog();
					return;
				}

				this.reconnectAttempt++;
				const delay = Math.min(RECONNECT_BASE_MS * RECONNECT_FACTOR ** (this.reconnectAttempt - 1), RECONNECT_MAX_MS);
				const jitter = delay * RECONNECT_JITTER * Math.random();
				this.logger.info(
					{ attempt: this.reconnectAttempt, delayMs: Math.round(delay + jitter) },
					"WhatsApp reconnecting",
				);
				setTimeout(() => this.createSocket(), delay + jitter);
			}
		});
	}

	private registerMessageHandler(): void {
		this.sock?.ev.on("messages.upsert", async ({ messages, type }) => {
			if (type !== "notify") return;

			for (const msg of messages) {
				if (!msg.message) continue;
				if (msg.key.fromMe) continue;

				const jid = msg.key.remoteJid;
				if (!jid || !jid.endsWith("@s.whatsapp.net")) continue;

				if (msg.key.id && this.recentlySent.has(msg.key.id)) continue;

				const messageType = getContentType(msg.message);
				const text = extractText(msg);
				const hasMedia = hasMediaContent(messageType);

				if (!text && !hasMedia) continue;

				const phoneNumber = jidToPhoneNumber(jid);

				if (this.handler) {
					this.lastMessageAt = Date.now();
					await this.handler({
						text: text ?? "",
						phoneNumber,
						jid,
						messageId: msg.key.id ?? "",
						pushName: msg.pushName ?? "Unknown",
						rawMessage: msg,
						mediaType: hasMedia ? (messageType ?? undefined) : undefined,
					});
				}
			}
		});
	}

	private trackSentMessage(messageId: string): void {
		this.recentlySent.add(messageId);
		setTimeout(() => this.recentlySent.delete(messageId), ECHO_TTL_MS);
	}

	private startWatchdog(): void {
		this.stopWatchdog();
		this.lastMessageAt = Date.now();
		this.watchdogTimer = setInterval(() => {
			if (Date.now() - this.lastMessageAt > WATCHDOG_STALE_MS) {
				this.logger.warn("WhatsApp watchdog — no messages in 30 minutes, forcing reconnect");
				if (this.sock) {
					this.sock.end(undefined);
				}
			}
		}, WATCHDOG_INTERVAL_MS);
	}

	private stopWatchdog(): void {
		if (this.watchdogTimer) {
			clearInterval(this.watchdogTimer);
			this.watchdogTimer = null;
		}
	}
}

// --- Pure utility functions (exported for testing) ---

export function extractText(msg: proto.IWebMessageInfo): string | null {
	if (!msg.message) return null;

	if (msg.message.conversation) return msg.message.conversation;
	if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
	if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
	if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
	if (msg.message.documentMessage?.caption) return msg.message.documentMessage.caption;

	return null;
}

export function hasMediaContent(messageType: string | undefined): boolean {
	if (!messageType) return false;
	return ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].includes(messageType);
}

export function jidToPhoneNumber(jid: string): string {
	const raw = jid.replace("@s.whatsapp.net", "");
	const number = raw.includes(":") ? raw.split(":")[0] : raw;
	return `+${number}`;
}
