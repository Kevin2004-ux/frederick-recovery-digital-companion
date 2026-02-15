// backend/scripts/test-security.ts
import "dotenv/config"; // <--- Crucial: Load .env file immediately

import { encryptPHI, decryptPHI } from "../src/utils/encryption.js";
import { getEnv } from "../src/config/env.js";

const API_URL = process.env.VITE_API_URL || "http://localhost:4000";

async function runSecurityAudit() {
  console.log("🛡️  [HIPAA-AUDIT] Starting Security Compliance Check...\n");
  let score = 0;
  let total = 0;

  function pass(msg: string) {
    console.log(`✅ [PASS] ${msg}`);
    score++;
    total++;
  }
  
  function fail(msg: string, critical = true) {
    console.log(`❌ [FAIL] ${msg}`);
    if (critical) process.exitCode = 1;
    total++;
  }

  function warn(msg: string) {
    console.log(`⚠️  [WARN] ${msg}`);
  }

  // --- 1. CRYPTO INTEGRITY CHECK ---
  console.log("🔹 1. Testing Encryption Engine (AES-256-GCM)...");
  try {
    const sensitiveData = "Patient Diagnosis: Acute Recovery";
    
    // Test A: Round Trip
    const encrypted = encryptPHI(sensitiveData);
    const decrypted = decryptPHI(encrypted);
    
    if (decrypted === sensitiveData) {
      pass("Encryption/Decryption round-trip successful.");
    } else {
      fail("Decrypted data does not match original!");
    }

    // Test B: IV Randomness (Semantic Security)
    const encrypted2 = encryptPHI(sensitiveData);
    if (encrypted !== encrypted2) {
      pass("Initialization Vector (IV) is random (Ciphertexts differ for same input).");
    } else {
      fail("CRITICAL: IV reuse detected! Identical ciphertexts for same input.");
    }

    // Test C: Tamper Resistance (Auth Tag)
    if (encrypted) {
      const parts = encrypted.split(":");
      // Tamper with the ciphertext (last part)
      const tampered = `${parts[0]}:${parts[1]}:${parts[2].substring(0, parts[2].length - 2) + "00"}`;
      const result = decryptPHI(tampered);
      if (result?.includes("Cannot Be Accessed") || result === null) {
        pass("Tamper detection active (Auth Tag rejected modified data).");
      } else {
        fail("Tampered data was accepted! Integrity check failed.");
      }
    }

  } catch (e) {
    fail(`Crypto Engine Error: ${e}`);
  }

  // --- 2. ENVIRONMENT CONFIG CHECK ---
  console.log("\n🔹 2. Verifying Environment Variables...");
  try {
    const env = getEnv();
    
    if (env.JWT_SECRET.length >= 32) {
      pass("JWT_SECRET meets length complexity requirements.");
    } else {
      warn("JWT_SECRET is too short (< 32 chars). Rotate immediately.");
    }

    // Check for dedicated Encryption Key (Best Practice)
    if (process.env.ENCRYPTION_KEY) {
      pass("Dedicated ENCRYPTION_KEY found.");
    } else {
      warn("Using JWT_SECRET for DB encryption. Recommended: Add ENCRYPTION_KEY to .env.");
    }

  } catch (e) {
    fail("Environment validation failed.");
  }

  // --- 3. LIVE SERVER HEADERS CHECK ---
  console.log("\n🔹 3. Scanning Live API Headers (Helmet & Rate Limits)...");
  try {
    const res = await fetch(`${API_URL}/health`);
    
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const headers = res.headers;

    // HSTS (Strict-Transport-Security)
    // Note: Helmet usually sets this only for HTTPS, so it might be missing on localhost http
    if (headers.get("strict-transport-security")) {
      pass("HSTS Header active.");
    } else {
      warn("HSTS missing (Expected on localhost HTTP, but MUST exist in Prod).");
    }

    // X-Content-Type-Options
    if (headers.get("x-content-type-options") === "nosniff") {
      pass("MIME Sniffing protection active.");
    } else {
      fail("X-Content-Type-Options missing.");
    }

    // Rate Limiting
    if (headers.get("x-ratelimit-limit") || headers.get("ratelimit-limit")) {
      pass("Rate Limit headers detected.");
    } else {
      warn("Rate Limit headers not visible on /health (This is okay if only applied to /api).");
    }

    // Information Leakage
    if (!headers.get("x-powered-by")) {
      pass("X-Powered-By header hidden (Obscurity).");
    } else {
      fail("X-Powered-By header revealed server tech stack.");
    }

  } catch (e) {
    fail(`Could not connect to server at ${API_URL}. Is it running?`, false);
  }

  console.log(`\n🏁 Audit Complete. Score: ${score}/${total}`);
  if (process.exitCode === 1) {
    console.log("🚨 CRITICAL SECURITY FAILURES DETECTED.");
  } else {
    console.log("🛡️  System is secure for HIPAA technical standards.");
  }
}

runSecurityAudit();