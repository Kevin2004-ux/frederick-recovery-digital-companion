// app/backend/src/repositories/userRepo.ts
import crypto from "crypto";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;

  // consent + onboarding
  consentAcceptedAt?: Date;

  // canonical going forward
  procedureName?: string;

  // legacy (keep for compatibility with older stored users / payloads)
  procedureCode?: string;

  recoveryStartDate?: string; // YYYY-MM-DD (ISO date-only)

  // email verification
  emailVerifiedAt?: Date;
  verificationCode?: string; // 6-digit
  verificationExpiresAt?: Date;
};

const usersById = new Map<string, UserRecord>();
const userIdByEmail = new Map<string, string>();

export type UpdateUserProfileInput = {
  procedureName: string;
  recoveryStartDate: string; // YYYY-MM-DD
};

export type UserProfile = {
  id: string;
  email: string;
  consentAcceptedAt?: string; // ISO string
  procedureName?: string;
  recoveryStartDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  emailVerifiedAt?: string; // ISO string
};

export function findUserByEmail(emailRaw: string): UserRecord | undefined {
  const email = emailRaw.trim().toLowerCase();
  const id = userIdByEmail.get(email);
  if (!id) return undefined;
  return usersById.get(id);
}

export function findUserById(id: string): UserRecord | undefined {
  return usersById.get(id);
}

export function createUser(params: { email: string; passwordHash: string }): UserRecord {
  const email = params.email.trim().toLowerCase();
  if (userIdByEmail.has(email)) {
    throw new Error("EMAIL_TAKEN");
  }

  const user: UserRecord = {
    id: crypto.randomUUID(),
    email,
    passwordHash: params.passwordHash,
    createdAt: new Date(),
  };

  usersById.set(user.id, user);
  userIdByEmail.set(email, user.id);
  return user;
}

export function acceptConsent(userId: string) {
  const user = usersById.get(userId);
  if (!user) return;
  user.consentAcceptedAt = new Date();
}

/** Generate/overwrite verification code + expiration for a user */
export function setVerificationCode(emailRaw: string, code: string, expiresAt: Date): void {
  const user = findUserByEmail(emailRaw);
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.emailVerifiedAt) return; // already verified, no-op

  user.verificationCode = code;
  user.verificationExpiresAt = expiresAt;
  usersById.set(user.id, user);
}

/** Verify a user’s email using the stored code */
export function verifyEmailCode(emailRaw: string, codeRaw: string): void {
  const user = findUserByEmail(emailRaw);
  if (!user) throw new Error("USER_NOT_FOUND");

  if (user.emailVerifiedAt) return; // already verified, no-op

  const code = codeRaw.trim();
  if (!user.verificationCode || !user.verificationExpiresAt) throw new Error("NO_CODE");
  if (new Date() > user.verificationExpiresAt) throw new Error("CODE_EXPIRED");
  if (user.verificationCode !== code) throw new Error("INVALID_CODE");

  user.emailVerifiedAt = new Date();
  user.verificationCode = undefined;
  user.verificationExpiresAt = undefined;
  usersById.set(user.id, user);
}

/**
 * Stores canonical procedureName.
 * If older code previously stored procedureCode, we keep it but do not require it.
 */
export function updateUserProfile(userId: string, input: UpdateUserProfileInput): UserProfile {
  const user = usersById.get(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  user.procedureName = input.procedureName;
  user.recoveryStartDate = input.recoveryStartDate;

  usersById.set(user.id, user);

  return getUserProfile(user.id);
}

export function getUserProfile(userId: string): UserProfile {
  const user = usersById.get(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // Compatibility: if procedureName missing but legacy procedureCode exists, present it as procedureName
  const procedureName = user.procedureName ?? user.procedureCode;

  return {
    id: user.id,
    email: user.email,
    consentAcceptedAt: user.consentAcceptedAt ? user.consentAcceptedAt.toISOString() : undefined,
    procedureName,
    recoveryStartDate: user.recoveryStartDate,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : undefined,
  };
}
