import crypto from "crypto";

/**
 * SHA256 hash function for Meta CAPI user data
 * Meta requires email, phone, and external_id to be hashed
 */
export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Normalize email for hashing
 * - Trim whitespace
 * - Convert to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize phone for hashing
 * - Remove all whitespace
 * - Should be in E.164 format (e.g., +14155551234)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "");
}
