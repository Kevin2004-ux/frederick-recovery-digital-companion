// app/backend/src/repositories/logRepo.ts
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export type RecoveryLogEntry = {
  date: string; // YYYY-MM-DD
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
  schemaVersion: number;
  details?: Record<string, unknown> | null;
};

export async function createEntry(
  userId: string,
  entry: Omit<RecoveryLogEntry, "schemaVersion"> & { schemaVersion?: number }
) {
  try {
    const stored = await prisma.logEntry.create({
      data: {
        userId,
        date: entry.date,
        painLevel: entry.painLevel,
        swellingLevel: entry.swellingLevel,
        notes: entry.notes,
        // ✅ Fix: Cast Record to InputJsonValue for Prisma
        details: (entry.details || {}) as Prisma.InputJsonValue,
        schemaVersion: entry.schemaVersion ?? 2,
      },
    });
    return stored;
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

  const updated = await prisma.logEntry.update({
    where: { id: existing.id },
    data: {
      painLevel: patch.painLevel,
      swellingLevel: patch.swellingLevel,
      notes: patch.notes,
      // ✅ Fix: Cast Record to InputJsonValue for Prisma
      details: (patch.details ?? existing.details ?? {}) as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function listEntries(userId: string) {
  return prisma.logEntry.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });
}

export async function listEntriesInRange(userId: string, from?: string, to?: string) {
  return prisma.logEntry.findMany({
    where: {
      userId,
      date: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    },
    orderBy: { date: "asc" },
  });
}