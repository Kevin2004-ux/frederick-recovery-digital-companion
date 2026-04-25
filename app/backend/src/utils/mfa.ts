import { UserRole } from "@prisma/client";
import { generateSecret, generateURI, verifySync } from "otplib";

const MFA_ISSUER = "Frederick Recovery";

export function isMfaEligibleRole(role: UserRole) {
  return role === UserRole.CLINIC || role === UserRole.OWNER;
}

export function normalizeMfaCode(code: string) {
  return code.replace(/\s+/g, "").trim();
}

export function generateMfaEnrollment(email: string) {
  const manualEntryKey = generateSecret();

  return {
    manualEntryKey,
    otpauthUrl: generateURI({
      issuer: MFA_ISSUER,
      label: email,
      secret: manualEntryKey,
    }),
  };
}

export function verifyMfaCode(secret: string, code: string) {
  return verifySync({
    secret,
    token: normalizeMfaCode(code),
  }).valid;
}
