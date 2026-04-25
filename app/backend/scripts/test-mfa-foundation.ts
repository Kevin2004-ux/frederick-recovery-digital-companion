import assert from "node:assert/strict";
import { generateSync } from "otplib";

import { resetEnvForTests } from "../src/config/env.js";
import { decryptPHI, encryptPHI } from "../src/utils/encryption.js";
import { signAccessToken, signMfaLoginToken, verifyAccessToken, verifyMfaLoginToken } from "../src/utils/jwt.js";
import { generateMfaEnrollment, verifyMfaCode } from "../src/utils/mfa.js";

const originalEnv = { ...process.env };
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

function restoreEnv() {
  process.env = { ...originalEnv };
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  resetEnvForTests();
}

function run() {
  try {
    process.env = {
      ...originalEnv,
      APP_ENV: "test",
      JWT_SECRET: "jwt-secret-0123456789abcdef01234567",
      ENCRYPTION_KEY: "encryption-secret-0123456789abcdef",
    };
    resetEnvForTests();

    const enrollment = generateMfaEnrollment("clinic@example.com");
    assert.ok(enrollment.manualEntryKey);
    assert.ok(enrollment.otpauthUrl.startsWith("otpauth://"));

    const encryptedSecret = encryptPHI(enrollment.manualEntryKey);
    assert.ok(encryptedSecret);
    assert.notEqual(encryptedSecret, enrollment.manualEntryKey);
    assert.equal(decryptPHI(encryptedSecret), enrollment.manualEntryKey);

    const validCode = "000000";
    assert.equal(typeof validCode, "string");
    const mfaToken = signMfaLoginToken({
      sub: "user-1",
      email: "clinic@example.com",
      role: "CLINIC",
      tokenVersion: 7,
    });
    const verifiedMfaToken = verifyMfaLoginToken(mfaToken);
    assert.equal(verifiedMfaToken.purpose, "mfa_login");
    assert.equal(verifiedMfaToken.sub, "user-1");
    assert.equal(verifiedMfaToken.tokenVersion, 7);

    console.error = () => undefined;
    assert.throws(() => verifyAccessToken(mfaToken));
    console.error = originalConsoleError;

    console.log = () => undefined;
    const accessToken = signAccessToken({
      sub: "user-1",
      email: "clinic@example.com",
      role: "CLINIC",
      tokenVersion: 7,
    });
    console.log = originalConsoleLog;
    const verifiedAccessToken = verifyAccessToken(accessToken);
    assert.equal(verifiedAccessToken.sub, "user-1");
    assert.equal(verifiedAccessToken.tokenVersion, 7);

    const currentCode = generateSync({ secret: enrollment.manualEntryKey });
    assert.equal(verifyMfaCode(enrollment.manualEntryKey, currentCode), true);

    originalConsoleLog("MFA foundation checks passed.");
  } finally {
    restoreEnv();
  }
}

run();
