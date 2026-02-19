import { afterEach, describe, expect, it, vi } from "vitest";
import { configSchema, validateConfig } from "./config";
import type { Config } from "./config";

describe("configSchema", () => {
	describe("valid configs", () => {
		it("parses minimal config with all defaults", () => {
			const result = configSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("coerces PORT string to number", () => {
			const result = configSchema.safeParse({ PORT: "8080" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.PORT).toBe(8080);
			}
		});

		it("applies all defaults correctly", () => {
			const result = configSchema.safeParse({});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.DB_TYPE).toBe("sqlite");
				expect(result.data.PORT).toBe(3000);
				expect(result.data.LOG_LEVEL).toBe("info");
				expect(result.data.DATA_DIR).toBe("./data");
				expect(result.data.SQLITE_PATH).toBe("./data/sketch.db");
			}
		});
	});

	describe("invalid configs", () => {
		it("rejects invalid DB_TYPE", () => {
			const result = configSchema.safeParse({ DB_TYPE: "mysql" });
			expect(result.success).toBe(false);
		});

		it("rejects invalid LOG_LEVEL", () => {
			const result = configSchema.safeParse({ LOG_LEVEL: "trace" });
			expect(result.success).toBe(false);
		});

		it("rejects SLACK_APP_TOKEN without xapp- prefix", () => {
			const result = configSchema.safeParse({ SLACK_APP_TOKEN: "invalid-token" });
			expect(result.success).toBe(false);
		});

		it("rejects SLACK_BOT_TOKEN without xoxb- prefix", () => {
			const result = configSchema.safeParse({ SLACK_BOT_TOKEN: "invalid-token" });
			expect(result.success).toBe(false);
		});

		it("rejects ANTHROPIC_BASE_URL with invalid URL", () => {
			const result = configSchema.safeParse({ ANTHROPIC_BASE_URL: "not-a-url" });
			expect(result.success).toBe(false);
		});
	});
});

describe("validateConfig", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function makeConfig(overrides: Partial<Config> = {}): Config {
		return {
			DB_TYPE: "sqlite",
			SQLITE_PATH: "./data/sketch.db",
			DATA_DIR: "./data",
			PORT: 3000,
			LOG_LEVEL: "info",
			...overrides,
		} as Config;
	}

	function mockProcessExit() {
		return vi.spyOn(process, "exit").mockImplementation(() => {
			throw new Error("exit");
		});
	}

	describe("LLM provider validation", () => {
		it("exits when no LLM provider is set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({ SLACK_APP_TOKEN: "xapp-test", SLACK_BOT_TOKEN: "xoxb-test" });
			expect(() => validateConfig(config)).toThrow("exit");
			expect(exitSpy).toHaveBeenCalledWith(1);
		});

		it("does not exit when only ANTHROPIC_API_KEY is set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				ANTHROPIC_API_KEY: "sk-test",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});

		it("does not exit when only CLAUDE_CODE_USE_BEDROCK is set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				CLAUDE_CODE_USE_BEDROCK: "1",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});

		it("does not exit when only CLAUDE_CODE_USE_VERTEX is set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				CLAUDE_CODE_USE_VERTEX: "1",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});

		it("does not exit when only ANTHROPIC_BASE_URL is set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				ANTHROPIC_BASE_URL: "https://api.example.com",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});
	});

	describe("Slack token validation", () => {
		it("exits when Slack tokens are missing", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({ ANTHROPIC_API_KEY: "sk-test" });
			expect(() => validateConfig(config)).toThrow("exit");
			expect(exitSpy).toHaveBeenCalledWith(1);
		});
	});

	describe("database validation", () => {
		it("exits when DB_TYPE is postgres without DATABASE_URL", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				DB_TYPE: "postgres",
				ANTHROPIC_API_KEY: "sk-test",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			expect(() => validateConfig(config)).toThrow("exit");
			expect(exitSpy).toHaveBeenCalledWith(1);
		});

		it("does not exit when DB_TYPE is postgres with DATABASE_URL set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				DB_TYPE: "postgres",
				DATABASE_URL: "postgresql://localhost:5432/sketch",
				ANTHROPIC_API_KEY: "sk-test",
				SLACK_APP_TOKEN: "xapp-test",
				SLACK_BOT_TOKEN: "xoxb-test",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});
	});
});
