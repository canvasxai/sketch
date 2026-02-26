import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("Password hashing", () => {
	it("hashPassword() produces a salt:hash string", async () => {
		const hash = await hashPassword("testpassword");
		expect(hash).toContain(":");
		const [salt, key] = hash.split(":");
		expect(salt).toHaveLength(64); // 32 bytes hex
		expect(key).toHaveLength(128); // 64 bytes hex
	});

	it("hashPassword() produces different hashes for same input", async () => {
		const hash1 = await hashPassword("testpassword");
		const hash2 = await hashPassword("testpassword");
		expect(hash1).not.toBe(hash2);
	});

	it("verifyPassword() returns true for correct password", async () => {
		const hash = await hashPassword("mypassword");
		expect(await verifyPassword("mypassword", hash)).toBe(true);
	});

	it("verifyPassword() returns false for wrong password", async () => {
		const hash = await hashPassword("mypassword");
		expect(await verifyPassword("wrongpassword", hash)).toBe(false);
	});

	it("verifyPassword() returns false for malformed hash", async () => {
		expect(await verifyPassword("test", "nocolon")).toBe(false);
		expect(await verifyPassword("test", "")).toBe(false);
	});
});
