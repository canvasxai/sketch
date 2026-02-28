import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configSchema, loadConfig, validateConfig } from "./config";
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
				expect(result.data.SLACK_CHANNEL_HISTORY_LIMIT).toBe(5);
				expect(result.data.SLACK_THREAD_HISTORY_LIMIT).toBe(50);
				expect(result.data.MAX_FILE_SIZE_MB).toBe(20);
			}
		});

		it("coerces SLACK_CHANNEL_HISTORY_LIMIT string to number", () => {
			const result = configSchema.safeParse({ SLACK_CHANNEL_HISTORY_LIMIT: "10" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.SLACK_CHANNEL_HISTORY_LIMIT).toBe(10);
			}
		});

		it("coerces SLACK_THREAD_HISTORY_LIMIT string to number", () => {
			const result = configSchema.safeParse({ SLACK_THREAD_HISTORY_LIMIT: "100" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.SLACK_THREAD_HISTORY_LIMIT).toBe(100);
			}
		});

		it("coerces MAX_FILE_SIZE_MB string to number", () => {
			const result = configSchema.safeParse({ MAX_FILE_SIZE_MB: "50" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.MAX_FILE_SIZE_MB).toBe(50);
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
	});
});

describe("loadConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("resolves DATA_DIR and SQLITE_PATH relative to DOTENV_CONFIG_PATH dir", () => {
		vi.stubEnv("DOTENV_CONFIG_PATH", "/project/root/.env");
		vi.stubEnv("DATA_DIR", "./data");
		vi.stubEnv("SQLITE_PATH", "./data/sketch.db");
		const config = loadConfig();
		expect(config.DATA_DIR).toBe("/project/root/data");
		expect(config.SQLITE_PATH).toBe("/project/root/data/sketch.db");
	});

	it("resolves relative paths against cwd when DOTENV_CONFIG_PATH is not set", () => {
		vi.stubEnv("DOTENV_CONFIG_PATH", "");
		vi.stubEnv("DATA_DIR", "./data");
		vi.stubEnv("SQLITE_PATH", "./data/sketch.db");
		const config = loadConfig();
		expect(config.DATA_DIR).toBe(resolve(process.cwd(), "./data"));
		expect(config.SQLITE_PATH).toBe(resolve(process.cwd(), "./data/sketch.db"));
	});

	it("leaves absolute paths unchanged", () => {
		vi.stubEnv("DATA_DIR", "/absolute/data");
		vi.stubEnv("SQLITE_PATH", "/absolute/data/sketch.db");
		const config = loadConfig();
		expect(config.DATA_DIR).toBe("/absolute/data");
		expect(config.SQLITE_PATH).toBe("/absolute/data/sketch.db");
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

	describe("Slack token validation", () => {
		it("does not exit when Slack tokens are missing (WhatsApp-only deployment)", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig();
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});
	});

	describe("database validation", () => {
		it("exits when DB_TYPE is postgres without DATABASE_URL", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				DB_TYPE: "postgres",
			});
			expect(() => validateConfig(config)).toThrow("exit");
			expect(exitSpy).toHaveBeenCalledWith(1);
		});

		it("does not exit when DB_TYPE is postgres with DATABASE_URL set", () => {
			const exitSpy = mockProcessExit();
			const config = makeConfig({
				DB_TYPE: "postgres",
				DATABASE_URL: "postgresql://localhost:5432/sketch",
			});
			validateConfig(config);
			expect(exitSpy).not.toHaveBeenCalled();
		});
	});
});
