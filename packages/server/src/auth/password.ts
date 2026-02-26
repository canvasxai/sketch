/**
 * Password hashing using Node's built-in crypto.scrypt.
 * Format: salt:hash (both hex-encoded). No external dependencies.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SALT_LENGTH);
	const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) return false;

	const salt = Buffer.from(saltHex, "hex");
	const storedHash = Buffer.from(hashHex, "hex");
	const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

	return timingSafeEqual(hash, storedHash);
}
