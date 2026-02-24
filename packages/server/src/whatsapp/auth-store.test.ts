import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DB } from "../db/schema";
import { createTestDb } from "../test-utils";
import { createDbAuthState } from "./auth-store";

let db: Kysely<DB>;

beforeEach(async () => {
	db = await createTestDb();
});

afterEach(async () => {
	await db.destroy();
});

describe("createDbAuthState", () => {
	it("initializes fresh creds when no creds stored", async () => {
		const { state } = await createDbAuthState(db);
		expect(state.creds).toBeDefined();
		expect(state.creds.registrationId).toBeDefined();
	});

	it("saveCreds persists and subsequent load retrieves correctly", async () => {
		const { state, saveCreds } = await createDbAuthState(db);
		const originalRegId = state.creds.registrationId;
		await saveCreds();

		const { state: state2 } = await createDbAuthState(db);
		expect(state2.creds.registrationId).toBe(originalRegId);
	});

	it("saveCreds overwrites existing creds (upsert)", async () => {
		const { state, saveCreds } = await createDbAuthState(db);
		await saveCreds();

		Object.assign(state.creds, { registrationId: 99999 });
		await saveCreds();

		const { state: state2 } = await createDbAuthState(db);
		expect(state2.creds.registrationId).toBe(99999);
	});

	it("keys.set stores keys and keys.get retrieves them", async () => {
		const { state } = await createDbAuthState(db);
		await state.keys.set({ "pre-key": { "1": { keyPair: "test-data" } as never } });
		const result = await state.keys.get("pre-key", ["1"]);
		expect(result["1"]).toEqual({ keyPair: "test-data" } as never);
	});

	it("keys.get returns empty object for unknown ids", async () => {
		const { state } = await createDbAuthState(db);
		const result = await state.keys.get("pre-key", ["999"]);
		expect(result).toEqual({});
	});

	it("keys.set with null value deletes the key from DB", async () => {
		const { state } = await createDbAuthState(db);
		await state.keys.set({ "pre-key": { "1": { keyPair: "test" } as never } });
		await state.keys.set({ "pre-key": { "1": null } });

		// Create a fresh auth state to bypass the in-memory cache layer
		// and verify the key was actually deleted from the database
		const { state: fresh } = await createDbAuthState(db);
		const result = await fresh.keys.get("pre-key", ["1"]);
		expect(result["1"]).toBeUndefined();
	});

	it("keys.set with multiple types stores each independently", async () => {
		const { state } = await createDbAuthState(db);
		await state.keys.set({
			"pre-key": { "1": { data: "pk" } as never },
			session: { "2": { data: "sess" } as never },
		});
		const pk = await state.keys.get("pre-key", ["1"]);
		const sess = await state.keys.get("session", ["2"]);
		expect(pk["1"]).toEqual({ data: "pk" });
		expect(sess["2"]).toEqual({ data: "sess" });
	});

	it("clearCreds removes all creds and keys", async () => {
		const { state, saveCreds, clearCreds } = await createDbAuthState(db);
		await saveCreds();
		await state.keys.set({ "pre-key": { "1": { data: "test" } as never } });
		await clearCreds();

		const { state: state2 } = await createDbAuthState(db);
		expect(state2.creds.registrationId).not.toBe(state.creds.registrationId);
		const result = await state2.keys.get("pre-key", ["1"]);
		expect(result["1"]).toBeUndefined();
	});
});
