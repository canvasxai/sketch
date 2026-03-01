/**
 * JWT signing and verification using jose (HS256).
 * Tokens are self-contained — no server-side session state needed.
 */
import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const EXPIRY = "7d";

function secretToKey(secret: string): Uint8Array {
	return new TextEncoder().encode(secret);
}

export async function signJwt(email: string, secret: string): Promise<string> {
	return new SignJWT({ sub: email })
		.setProtectedHeader({ alg: ALG })
		.setIssuedAt()
		.setExpirationTime(EXPIRY)
		.sign(secretToKey(secret));
}

export async function verifyJwt(token: string, secret: string): Promise<{ email: string } | null> {
	try {
		const { payload } = await jwtVerify(token, secretToKey(secret));
		if (typeof payload.sub !== "string") return null;
		return { email: payload.sub };
	} catch {
		return null;
	}
}
