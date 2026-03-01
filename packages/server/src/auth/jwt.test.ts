import { describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "./jwt";

const SECRET = "a".repeat(64);

describe("JWT sign and verify", () => {
	it("signJwt() produces a token that verifyJwt() can decode", async () => {
		const token = await signJwt("admin@example.com", SECRET);
		const payload = await verifyJwt(token, SECRET);
		expect(payload).toEqual({ email: "admin@example.com" });
	});

	it("verifyJwt() returns the correct email from the sub claim", async () => {
		const token = await signJwt("user@test.org", SECRET);
		const payload = await verifyJwt(token, SECRET);
		expect(payload?.email).toBe("user@test.org");
	});

	it("verifyJwt() returns null for a token signed with a different secret", async () => {
		const token = await signJwt("admin@example.com", SECRET);
		const payload = await verifyJwt(token, "b".repeat(64));
		expect(payload).toBeNull();
	});

	it("verifyJwt() returns null for malformed tokens", async () => {
		expect(await verifyJwt("not-a-jwt", SECRET)).toBeNull();
		expect(await verifyJwt("", SECRET)).toBeNull();
		expect(await verifyJwt("a.b.c", SECRET)).toBeNull();
	});

	it("verifyJwt() returns null for an expired token", async () => {
		// Create a token with 0s expiry by importing jose directly
		const { SignJWT } = await import("jose");
		const token = await new SignJWT({ sub: "admin@example.com" })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("0s")
			.sign(new TextEncoder().encode(SECRET));

		const payload = await verifyJwt(token, SECRET);
		expect(payload).toBeNull();
	});
});
