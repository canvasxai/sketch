import { describe, expect, it, vi } from "vitest";
import { createSlackStartupManager } from "./startup";

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("createSlackStartupManager", () => {
	it("skips startup when no tokens are configured", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const start = createSlackStartupManager({
			logger,
			getSettingsTokens: async () => ({ botToken: null, appToken: null }),
			validateTokens: vi.fn(),
			getCurrentBot: () => null,
			setCurrentBot: vi.fn(),
			createBot: vi.fn(),
		});

		await start();

		expect(logger.info).toHaveBeenCalledWith("Slack tokens not configured — skipping Slack bot startup");
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("uses provided tokens and bypasses DB lookup", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const getSettingsTokens = vi.fn(async () => ({ botToken: "xoxb-db", appToken: "xapp-db" }));
		const validateTokens = vi.fn(async () => {});
		const startBot = vi.fn(async () => {});
		const stopBot = vi.fn(async () => {});
		let currentBot: { start: () => Promise<void>; stop: () => Promise<void> } | null = {
			start: startBot,
			stop: stopBot,
		};

		const createBot = vi.fn(() => ({ start: startBot, stop: stopBot }));
		const setCurrentBot = vi.fn((bot) => {
			currentBot = bot;
		});

		const start = createSlackStartupManager({
			logger,
			getSettingsTokens,
			validateTokens,
			getCurrentBot: () => currentBot,
			setCurrentBot,
			createBot,
		});

		await start({ botToken: "xoxb-provided", appToken: "xapp-provided" });

		expect(getSettingsTokens).not.toHaveBeenCalled();
		expect(validateTokens).toHaveBeenCalledWith("xoxb-provided", "xapp-provided");
		expect(stopBot).toHaveBeenCalledTimes(1);
		expect(createBot).toHaveBeenCalledWith({ botToken: "xoxb-provided", appToken: "xapp-provided" });
		expect(startBot).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenCalledWith("Slack bot connected");
	});

	it("enforces single-flight concurrency while startup is in progress", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const gate = deferred<void>();
		const validateTokens = vi.fn(async () => {
			await gate.promise;
		});
		const startBot = vi.fn(async () => {});
		const createBot = vi.fn(() => ({ start: startBot, stop: vi.fn(async () => {}) }));

		const start = createSlackStartupManager({
			logger,
			getSettingsTokens: async () => ({ botToken: "xoxb-db", appToken: "xapp-db" }),
			validateTokens,
			getCurrentBot: () => null,
			setCurrentBot: vi.fn(),
			createBot,
		});

		const first = start();
		const second = start();

		gate.resolve();
		await Promise.all([first, second]);

		expect(validateTokens).toHaveBeenCalledTimes(1);
		expect(createBot).toHaveBeenCalledTimes(1);
	});

	it("throws for explicit token startup when token validation fails", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const start = createSlackStartupManager({
			logger,
			getSettingsTokens: async () => ({ botToken: "xoxb-db", appToken: "xapp-db" }),
			validateTokens: vi.fn(async () => {
				throw new Error("invalid_auth");
			}),
			getCurrentBot: () => null,
			setCurrentBot: vi.fn(),
			createBot: vi.fn(),
		});

		await expect(start({ botToken: "xoxb-provided", appToken: "xapp-provided" })).rejects.toThrow(
			"Invalid Slack tokens",
		);
		expect(logger.warn).toHaveBeenCalledWith(expect.any(Object), "Slack tokens failed validation");
	});

	it("swallows startup errors for boot-time DB startup", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		const start = createSlackStartupManager({
			logger,
			getSettingsTokens: async () => ({ botToken: "xoxb-db", appToken: "xapp-db" }),
			validateTokens: vi.fn(async () => {
				throw new Error("invalid_auth");
			}),
			getCurrentBot: () => null,
			setCurrentBot: vi.fn(),
			createBot: vi.fn(),
		});

		await expect(start()).resolves.toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(expect.any(Object), "Skipping Slack startup");
	});

	it("clears current bot when bot start fails", async () => {
		const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
		let currentBot: { start: () => Promise<void>; stop: () => Promise<void> } | null = null;
		const setCurrentBot = vi.fn((bot) => {
			currentBot = bot;
		});

		const start = createSlackStartupManager({
			logger,
			getSettingsTokens: async () => ({ botToken: "xoxb-db", appToken: "xapp-db" }),
			validateTokens: vi.fn(async () => {}),
			getCurrentBot: () => currentBot,
			setCurrentBot,
			createBot: () => ({
				start: async () => {
					throw new Error("socket_failed");
				},
				stop: vi.fn(async () => {}),
			}),
		});

		await expect(start({ botToken: "xoxb-provided", appToken: "xapp-provided" })).rejects.toThrow(
			"Invalid Slack tokens",
		);
		expect(logger.error).toHaveBeenCalledWith(
			expect.any(Object),
			"Failed to start Slack bot, disabling Slack integration",
		);
		expect(currentBot).toBeNull();
		expect(setCurrentBot).toHaveBeenLastCalledWith(null);
	});
});
