// app/backend/src/repositories/userRepo.ts
import crypto from "crypto";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;

  // consent + onboarding placeholders for next steps
  consentAcceptedAt?: Date;
  procedureCode?: string;
  recoveryStartDate?: string; // YYYY-MM-DD (ISO date-only)
};

const usersById = new Map<string, UserRecord>();
const userIdByEmail = new Map<string, string>();

export type UpdateUserProfileInput = {
  procedureCode: string;
  recoveryStartDate: string; // YYYY-MM-DD
};

export type UserProfile = {
  id: string;
  email: string;
  consentAcceptedAt?: string; // ISO string
  procedureCode?: string;
  recoveryStartDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO string
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

export function updateUserProfile(userId: string, input: UpdateUserProfileInput): UserProfile {
  const user = usersById.get(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  user.procedureCode = input.procedureCode;
  user.recoveryStartDate = input.recoveryStartDate;

  usersById.set(user.id, user);

  return {
    id: user.id,
    email: user.email,
    consentAcceptedAt: user.consentAcceptedAt ? user.consentAcceptedAt.toISOString() : undefined,
    procedureCode: user.procedureCode,
    recoveryStartDate: user.recoveryStartDate,
    createdAt: user.createdAt.toISOString(),
  };
}

export function getUserProfile(userId: string): UserProfile {
  const user = usersById.get(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: user.id,
    email: user.email,
    consentAcceptedAt: user.consentAcceptedAt ? user.consentAcceptedAt.toISOString() : undefined,
    procedureCode: user.procedureCode,
    recoveryStartDate: user.recoveryStartDate,
    createdAt: user.createdAt.toISOString(),
  };
}
