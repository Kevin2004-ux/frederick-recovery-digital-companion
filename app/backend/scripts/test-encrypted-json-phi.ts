import assert from "node:assert/strict";

import { resetEnvForTests } from "../src/config/env.js";
import { decryptJsonPHI, encryptJsonPHI } from "../src/utils/encryption.js";

const originalEnv = { ...process.env };
const originalConsoleError = console.error;

function restoreEnv() {
  process.env = { ...originalEnv };
  console.error = originalConsoleError;
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

    const objectPayload = {
      redFlags: ["fever", "severe swelling"],
      symptoms: ["pain"],
      nested: { medications: ["rx"] },
    };

    const encryptedObject = encryptJsonPHI(objectPayload);
    assert.ok(encryptedObject);
    assert.deepEqual(Object.keys(encryptedObject).sort(), ["__encrypted", "value"]);
    assert.equal(encryptedObject?.__encrypted, true);
    assert.equal(typeof encryptedObject?.value, "string");
    assert.ok(!encryptedObject?.value.includes("fever"));
    assert.ok(!encryptedObject?.value.includes("pain"));
    assert.deepEqual(decryptJsonPHI(encryptedObject), objectPayload);

    const arrayPayload = ["missed_recent_check_in", "critical_red_flag_logged"];
    const encryptedArray = encryptJsonPHI(arrayPayload);
    assert.ok(encryptedArray);
    assert.deepEqual(decryptJsonPHI(encryptedArray), arrayPayload);

    const plaintextJson = { existing: true, redFlags: ["legacy"] };
    assert.deepEqual(decryptJsonPHI(plaintextJson), plaintextJson);

    const tamperedWrapper = encryptedObject
      ? {
          ...encryptedObject,
          value: `${encryptedObject.value}00`,
        }
      : null;
    console.error = () => undefined;
    assert.equal(decryptJsonPHI(tamperedWrapper), null);
    console.error = originalConsoleError;

    assert.equal(encryptJsonPHI(null), null);
    assert.equal(encryptJsonPHI(undefined), null);
    assert.equal(decryptJsonPHI(null), null);

    console.log("Encrypted JSON PHI checks passed.");
  } finally {
    restoreEnv();
  }
}

run();
