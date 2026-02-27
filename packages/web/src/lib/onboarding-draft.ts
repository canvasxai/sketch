export type LlmProvider = "anthropic" | "bedrock";

export interface OnboardingDraftV1 {
	version: 1;
	updatedAt: number;
	currentStep: number;
	maxStepReached: number;

	adminEmail: string;
	adminPassword: string;

	organizationName: string;
	botName: string;

	slackConnected: boolean;
	slackWorkspace?: string;
	slackBotToken: string;
	slackAppToken: string;

	whatsappConnected: boolean;
	whatsappPhone?: string;

	llmProvider: LlmProvider;
	llmConnected: boolean;
	anthropicApiKey: string;
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	awsRegion: string;

	invitedCount: number;
}

const STORAGE_KEY = "sketch:onboardingDraft:v1";

function getStorage(): Storage | null {
	if (typeof window === "undefined") return null;
	return window.sessionStorage ?? null;
}

export function loadOnboardingDraft(): OnboardingDraftV1 | null {
	const storage = getStorage();
	if (!storage) return null;

	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as OnboardingDraftV1;
		if (!parsed || parsed.version !== 1) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function saveOnboardingDraft(draft: OnboardingDraftV1): void {
	const storage = getStorage();
	if (!storage) return;

	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// Best-effort persistence only; ignore quota/serialization failures.
	}
}

export function clearOnboardingDraft(): void {
	const storage = getStorage();
	if (!storage) return;
	try {
		storage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
