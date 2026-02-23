/**
 * Validates and exports typed configuration from environment variables.
 * Uses zod for schema validation and dotenv for .env file loading.
 * Fails fast on startup with all errors printed at once.
 */
import { z } from "zod";
import "dotenv/config";

export const configSchema = z.object({
	// Database
	DB_TYPE: z.enum(["sqlite", "postgres"]).default("sqlite"),
	SQLITE_PATH: z.string().default("./data/sketch.db"),
	DATABASE_URL: z.string().optional(),

	// LLM — direct API, Bedrock, Vertex, or custom base URL
	ANTHROPIC_API_KEY: z.string().optional(),
	ANTHROPIC_BASE_URL: z.string().url().optional(),
	ANTHROPIC_AUTH_TOKEN: z.string().optional(),
	ANTHROPIC_MODEL: z.string().optional(),
	CLAUDE_CODE_USE_BEDROCK: z.string().optional(),
	CLAUDE_CODE_USE_VERTEX: z.string().optional(),

	// Slack
	SLACK_APP_TOKEN: z.string().startsWith("xapp-").optional(),
	SLACK_BOT_TOKEN: z.string().startsWith("xoxb-").optional(),

	// Slack context
	SLACK_CHANNEL_HISTORY_LIMIT: z.coerce.number().default(5),
	SLACK_THREAD_HISTORY_LIMIT: z.coerce.number().default(50),

	// Files
	MAX_FILE_SIZE_MB: z.coerce.number().default(20),

	// Server
	DATA_DIR: z.string().default("./data"),
	PORT: z.coerce.number().default(3000),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
	const result = configSchema.safeParse(process.env);
	if (!result.success) {
		console.error("Invalid configuration:");
		for (const issue of result.error.issues) {
			console.error(`  ${issue.path.join(".")}: ${issue.message}`);
		}
		process.exit(1);
	}
	return result.data;
}

/**
 * Semantic validation that can't be expressed in zod schema alone.
 * Checks cross-field dependencies after loadConfig() succeeds.
 */
export function validateConfig(config: Config): void {
	const hasLlmProvider =
		config.ANTHROPIC_API_KEY ||
		config.ANTHROPIC_BASE_URL ||
		config.CLAUDE_CODE_USE_BEDROCK ||
		config.CLAUDE_CODE_USE_VERTEX;
	if (!hasLlmProvider) {
		console.error("Must set ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, CLAUDE_CODE_USE_BEDROCK, or CLAUDE_CODE_USE_VERTEX");
		process.exit(1);
	}

	if (!config.SLACK_APP_TOKEN || !config.SLACK_BOT_TOKEN) {
		console.error("Must set SLACK_APP_TOKEN and SLACK_BOT_TOKEN");
		process.exit(1);
	}

	if (config.DB_TYPE === "postgres" && !config.DATABASE_URL) {
		console.error("DB_TYPE=postgres requires DATABASE_URL");
		process.exit(1);
	}
}
