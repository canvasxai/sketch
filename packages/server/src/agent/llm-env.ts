import type { SettingsTable } from "../db/schema";
import type { Logger } from "../logger";

type LlmSettings = Pick<
	SettingsTable,
	"llm_provider" | "anthropic_api_key" | "aws_access_key_id" | "aws_secret_access_key" | "aws_region"
>;

function clearProviderRoutingEnv() {
	process.env.CLAUDE_CODE_USE_BEDROCK = undefined;
	process.env.CLAUDE_CODE_USE_VERTEX = undefined;
	process.env.CLAUDE_CODE_USE_FOUNDRY = undefined;
	process.env.ANTHROPIC_BASE_URL = undefined;
	process.env.ANTHROPIC_AUTH_TOKEN = undefined;
}

export function applyLlmEnvFromSettings(settings: LlmSettings | null, logger?: Logger): void {
	if (!settings || !settings.llm_provider) {
		logger?.warn("No LLM provider configured in settings; using existing environment-based LLM config");
		return;
	}

	if (settings.llm_provider === "anthropic") {
		if (!settings.anthropic_api_key) {
			logger?.warn(
				{ llmProvider: settings.llm_provider, hasAnthropicKey: false },
				"Incomplete LLM settings in DB; preserving existing environment-based LLM config",
			);
			return;
		}

		clearProviderRoutingEnv();
		process.env.AWS_ACCESS_KEY_ID = undefined;
		process.env.AWS_SECRET_ACCESS_KEY = undefined;
		process.env.AWS_REGION = undefined;
		process.env.ANTHROPIC_API_KEY = settings.anthropic_api_key;
		logger?.info({ llmProvider: "anthropic", source: "db" }, "Configured LLM provider from DB settings");
		return;
	}

	if (settings.llm_provider === "bedrock") {
		if (!settings.aws_access_key_id || !settings.aws_secret_access_key || !settings.aws_region) {
			logger?.warn(
				{
					llmProvider: settings.llm_provider,
					hasAwsAccessKeyId: Boolean(settings.aws_access_key_id),
					hasAwsSecretAccessKey: Boolean(settings.aws_secret_access_key),
					hasAwsRegion: Boolean(settings.aws_region),
				},
				"Incomplete LLM settings in DB; preserving existing environment-based LLM config",
			);
			return;
		}

		clearProviderRoutingEnv();
		process.env.ANTHROPIC_API_KEY = undefined;
		process.env.CLAUDE_CODE_USE_BEDROCK = "1";
		process.env.AWS_ACCESS_KEY_ID = settings.aws_access_key_id;
		process.env.AWS_SECRET_ACCESS_KEY = settings.aws_secret_access_key;
		process.env.AWS_REGION = settings.aws_region;
		logger?.info({ llmProvider: "bedrock", source: "db" }, "Configured LLM provider from DB settings");
		return;
	}

	logger?.warn(
		{
			llmProvider: settings.llm_provider,
			supportedProviders: ["anthropic", "bedrock"],
		},
		"Unsupported LLM provider in DB; preserving existing environment-based LLM config",
	);
}
