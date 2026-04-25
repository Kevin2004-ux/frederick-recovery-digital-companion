// app/backend/src/repositories/logRepo.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";// Import the new encryption utilities
import {
  encryptPHI,
  decryptPHI,
  encryptJsonPHI,
  decryptJsonPHI,
  isEncryptedJsonPHI,
} from "../utils/encryption.js";

export type RecoveryLogEntry = {
  date: string; // YYYY-MM-DD
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
  schemaVersion: number;
  details?: Record<string, unknown> | null;
};

function decryptStoredEntry<T extends { notes: string | null; details: Prisma.JsonValue | null }>(
  entry: T
) {
  return {
    ...entry,
    notes: decryptPHI(entry.notes),
    details: decryptJsonPHI<RecoveryLogEntry["details"]>(entry.details),
  };
}

export async function createEntry(
  userId: string,
  entry: Omit<RecoveryLogEntry, "schemaVersion"> & { schemaVersion?: number }
) {
  try {
    // ENCRYPTION: Protect notes before DB insertion
    const secureNotes = encryptPHI(entry.notes);
    const secureDetails = encryptJsonPHI(entry.details || {});

    const stored = await prisma.logEntry.create({
      data: {
        userId,
        date: entry.date,
        painLevel: entry.painLevel,
        swellingLevel: entry.swellingLevel,
        notes: secureNotes, // <--- Encrypted
        details: secureDetails as Prisma.InputJsonValue,
        schemaVersion: entry.schemaVersion ?? 2,
      },
    });
    
    // DECRYPTION: Return readable data to the caller (so the UI updates immediately)
    return decryptStoredEntry(stored);

  } catch (e: any) {
    if (e?.code === "P2002") {
      const err = new Error("Entry already exists for this date");
      (err as any).code = "ENTRY_ALREADY_EXISTS";
      throw err;
    }
    throw e;
  }
}

export async function updateEntry(
  userId: string,
  date: string,
  patch: Pick<RecoveryLogEntry, "painLevel" | "swellingLevel" | "details"> & {
    notes?: string;
  }
) {
  const existing = await prisma.logEntry.findUnique({
    where: { userId_date: { userId, date } },
  });

  if (!existing) {
    const err = new Error("No entry exists for this date");
    (err as any).code = "NOT_FOUND";
    throw err;
  }

  // ENCRYPTION: Only encrypt if notes are being updated
  // We use a ternary to strictly preserve 'undefined' (do not update) vs 'null' (clear field)
  const secureNotes = patch.notes !== undefined ? encryptPHI(patch.notes) : undefined;
  const secureDetails: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
    patch.details === undefined || patch.details === null
      ? isEncryptedJsonPHI(existing.details)
        ? existing.details
        : (encryptJsonPHI(existing.details ?? {}) as Prisma.InputJsonValue)
      : ((encryptJsonPHI(patch.details) ?? Prisma.JsonNull) as Prisma.InputJsonValue);

  const updated = await prisma.logEntry.update({
    where: { id: existing.id },
    data: {
      painLevel: patch.painLevel,
      swellingLevel: patch.swellingLevel,
      notes: secureNotes, // <--- Encrypted (or undefined to skip)
      details: secureDetails,
    },
  });

  // DECRYPTION: Return cleartext
  return decryptStoredEntry(updated);
}

export async function listEntries(userId: string) {
  const rawEntries = await prisma.logEntry.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  // DECRYPTION: Decrypt all notes before returning list
  return rawEntries.map(decryptStoredEntry);
}

export async function listEntriesInRange(userId: string, from?: string, to?: string) {
  const rawEntries = await prisma.logEntry.findMany({
    where: {
      userId,
      date: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    },
    orderBy: { date: "asc" },
  });

  // DECRYPTION: Decrypt all notes
  return rawEntries.map(decryptStoredEntry);
}
