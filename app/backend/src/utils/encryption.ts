// app/backend/src/utils/encryption.ts
import crypto from "crypto";
import { getEnv } from "../config/env.js";

// Algorithm: AES-256-GCM (Authenticated Encryption)
// Prevents tampering and ensures confidentiality.
const ALGORITHM = "aes-256-gcm";
const MISSING_ENCRYPTION_KEY_ERROR = "ENCRYPTION_KEY is required for PHI encryption";

function getKey(): Buffer {
  const env = getEnv();

  if (!env.ENCRYPTION_KEY) {
    throw new Error(MISSING_ENCRYPTION_KEY_ERROR);
  }

  return crypto.createHash("sha256").update(env.ENCRYPTION_KEY).digest();
}

function isMissingEncryptionKeyError(error: unknown): boolean {
  return error instanceof Error && error.message === MISSING_ENCRYPTION_KEY_ERROR;
}

/**
 * Encrypts a cleartext string (e.g., patient notes).
 * Returns format: "iv:authTag:ciphertext" (Hex encoded)
 */
export function encryptPHI(text: string | null | undefined): string | null {
  if (!text) return null;

  try {
    const key = getKey();
    const iv = crypto.randomBytes(16); // Initialization Vector
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    // Store everything needed to decrypt: IV + Tag + Content
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    if (isMissingEncryptionKeyError(error)) {
      throw error;
    }

    throw new Error("Failed to secure sensitive data");
  }
}

/**
 * Decrypts the stored string back to cleartext.
 */
export function decryptPHI(stored: string | null | undefined): string | null {
  if (!stored) return null;

  try {
    const parts = stored.split(":");
    if (parts.length !== 3) {
      // If data doesn't match format, return as-is (backward compatibility for old plain text)
      // In a strict audit, you might want to log a warning here.
      return stored; 
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    
    const key = getKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    if (isMissingEncryptionKeyError(error)) {
      throw error;
    }

    console.error("[CRYPTO] Decryption failed or data tampered");
    // Fail safe: Do not return garbage/corrupted data
    return "[Encrypted Data Cannot Be Accessed]";
  }
}
