import assert from "node:assert/strict";

import { getEnv, resetEnvForTests } from "../src/config/env.js";
import { decryptPHI, encryptPHI } from "../src/utils/encryption.js";

type EnvPatch = Record<string, string | undefined>;

const originalEnv = { ...process.env };

function applyEnv(patch: EnvPatch) {
  process.env = { ...originalEnv };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  resetEnvForTests();
}

function restoreEnv() {
  process.env = { ...originalEnv };
  resetEnvForTests();
}

function expectThrows(fn: () => unknown, message: string) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, new RegExp(message));
    return true;
  });
}

function run() {
  try {
    const productionBase = {
      APP_ENV: "production",
      JWT_SECRET: "jwt-secret-0123456789abcdef01234567",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
    };

    applyEnv({
      APP_ENV: "test",
      JWT_SECRET: "jwt-secret-0123456789abcdef01234567",
      ENCRYPTION_KEY: "encryption-secret-0123456789abcdef",
    });

    const plaintext = "Patient notes: keep private";
    const encrypted = encryptPHI(plaintext);

    assert.ok(encrypted);
    assert.notEqual(encrypted, plaintext);
    assert.equal(encrypted?.split(":").length, 3);
    assert.equal(decryptPHI(encrypted), plaintext);

    applyEnv({
      APP_ENV: "test",
      JWT_SECRET: "different-jwt-secret-0123456789abcd",
      ENCRYPTION_KEY: "encryption-secret-0123456789abcdef",
    });

    assert.equal(decryptPHI(encrypted), plaintext);

    applyEnv({
      ...productionBase,
      ENCRYPTION_KEY: undefined,
    });

    expectThrows(
      () => getEnv(),
      "ENCRYPTION_KEY is required when APP_ENV is production",
    );

    applyEnv({
      ...productionBase,
      ENCRYPTION_KEY: "production-encryption-key-0123456789",
    });

    const env = getEnv();
    assert.equal(env.APP_ENV, "production");
    assert.equal(env.ENCRYPTION_KEY, "production-encryption-key-0123456789");

    console.log("Encryption/env checks passed.");
  } finally {
    restoreEnv();
  }
}

run();
