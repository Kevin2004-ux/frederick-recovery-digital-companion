// app/backend/src/utils/encryption.ts
import crypto from "crypto";
import { getEnv } from "../config/env.js";

// Algorithm: AES-256-GCM (Authenticated Encryption)
// Prevents tampering and ensures confidentiality.
const ALGORITHM = "aes-256-gcm";
const MISSING_ENCRYPTION_KEY_ERROR = "ENCRYPTION_KEY is required for PHI encryption";
const ENCRYPTED_DATA_FAILURE_MESSAGE = "[Encrypted Data Cannot Be Accessed]";

type EncryptedJsonWrapper = {
  __encrypted: true;
  value: string;
};

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

function isEncryptedJsonWrapper(value: unknown): value is EncryptedJsonWrapper {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).__encrypted === true &&
    typeof (value as Record<string, unknown>).value === "string"
  );
}

export function isEncryptedJsonPHI(value: unknown): value is EncryptedJsonWrapper {
  return isEncryptedJsonWrapper(value);
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
    return ENCRYPTED_DATA_FAILURE_MESSAGE;
  }
}

export function encryptJsonPHI(value: unknown): EncryptedJsonWrapper | null {
  if (value === null || value === undefined) return null;

  const serialized = JSON.stringify(value);
  if (serialized === undefined) return null;

  const encrypted = encryptPHI(serialized);
  if (!encrypted) return null;

  return {
    __encrypted: true,
    value: encrypted,
  };
}

export function decryptJsonPHI<T = unknown>(value: unknown): T | null {
  if (value === null || value === undefined) return null;

  if (!isEncryptedJsonWrapper(value)) {
    return value as T;
  }

  const decrypted = decryptPHI(value.value);
  if (!decrypted || decrypted === ENCRYPTED_DATA_FAILURE_MESSAGE) {
    return null;
  }

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}
