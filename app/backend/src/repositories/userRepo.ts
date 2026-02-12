// app/backend/src/repositories/userRepo.ts
import { prisma } from "../prisma/client.js";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;

  consentAcceptedAt?: Date | null;

  procedureName?: string | null;
  procedureCode?: string | null;
  recoveryStartDate?: string | null;

  emailVerifiedAt?: Date | null;
  verificationCode?: string | null;
  verificationExpiresAt?: Date | null;

  role?: "PATIENT" | "CLINIC";
};

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
  role?: "PATIENT" | "CLINIC";
};

function normalizeEmail(emailRaw: string) {
  return emailRaw.trim().toLowerCase();
}

export async function findUserByEmail(emailRaw: string): Promise<UserRecord | null> {
  const email = normalizeEmail(emailRaw);
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      createdAt: true,
      consentAcceptedAt: true,
      procedureName: true,
      procedureCode: true,
      recoveryStartDate: true,
      emailVerifiedAt: true,
      verificationCode: true,
      verificationExpiresAt: true,
      role: true,
    },
  });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      createdAt: true,
      consentAcceptedAt: true,
      procedureName: true,
      procedureCode: true,
      recoveryStartDate: true,
      emailVerifiedAt: true,
      verificationCode: true,
      verificationExpiresAt: true,
      role: true,
    },
  });
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  role?: "PATIENT" | "CLINIC";
}): Promise<UserRecord> {
  const email = normalizeEmail(params.email);

  try {
    return await prisma.user.create({
      data: {
        email,
        passwordHash: params.passwordHash,
        role: params.role ?? "PATIENT",
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        createdAt: true,
        consentAcceptedAt: true,
        procedureName: true,
        procedureCode: true,
        recoveryStartDate: true,
        emailVerifiedAt: true,
        verificationCode: true,
        verificationExpiresAt: true,
        role: true,
      },
    });
  } catch (e: any) {
    // Prisma unique violation
    if (e?.code === "P2002") throw new Error("EMAIL_TAKEN");
    throw e;
  }
}

export async function acceptConsent(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { consentAcceptedAt: new Date() },
  });
}

/** Generate/overwrite verification code + expiration for a user */
export async function setVerificationCode(emailRaw: string, code: string, expiresAt: Date): Promise<void> {
  const email = normalizeEmail(emailRaw);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.emailVerifiedAt) return; // already verified, no-op

  await prisma.user.update({
    where: { email },
    data: {
      verificationCode: code,
      verificationExpiresAt: expiresAt,
    },
  });
}

/** Verify a user’s email using the stored code */
export async function verifyEmailCode(emailRaw: string, codeRaw: string): Promise<void> {
  const email = normalizeEmail(emailRaw);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerifiedAt: true,
      verificationCode: true,
      verificationExpiresAt: true,
    },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.emailVerifiedAt) return;

  const code = codeRaw.trim();

  if (!user.verificationCode || !user.verificationExpiresAt) throw new Error("NO_CODE");
  if (new Date() > user.verificationExpiresAt) throw new Error("CODE_EXPIRED");
  if (user.verificationCode !== code) throw new Error("INVALID_CODE");

  await prisma.user.update({
    where: { email },
    data: {
      emailVerifiedAt: new Date(),
      verificationCode: null,
      verificationExpiresAt: null,
    },
  });
}

/**
 * Stores canonical procedureName.
 * If older code previously stored procedureCode, we keep it but do not require it.
 */
export async function updateUserProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      procedureName: input.procedureName,
      recoveryStartDate: input.recoveryStartDate,
    },
  });

  return getUserProfile(userId);
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      consentAcceptedAt: true,
      procedureName: true,
      procedureCode: true,
      recoveryStartDate: true,
      emailVerifiedAt: true,
      role: true,
    },
  });

  if (!user) throw new Error("USER_NOT_FOUND");

  // Compatibility: if procedureName missing but legacy procedureCode exists, present it as procedureName
  const procedureName = user.procedureName ?? user.procedureCode ?? undefined;

  return {
    id: user.id,
    email: user.email,
    consentAcceptedAt: user.consentAcceptedAt ? user.consentAcceptedAt.toISOString() : undefined,
    procedureName,
    recoveryStartDate: user.recoveryStartDate ?? undefined,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : undefined,
    role: user.role ?? undefined,
  };
}
