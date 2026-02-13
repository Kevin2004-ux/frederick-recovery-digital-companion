import { prisma } from "../prisma/client.js";
export async function createEntry(userId, entry) {
    try {
        const stored = await prisma.logEntry.create({
            data: {
                userId,
                date: entry.date,
                painLevel: entry.painLevel,
                swellingLevel: entry.swellingLevel,
                notes: entry.notes,
                // ✅ Fix: Cast Record to InputJsonValue for Prisma
                details: (entry.details || {}),
                schemaVersion: entry.schemaVersion ?? 2,
            },
        });
        return stored;
    }
    catch (e) {
        if (e?.code === "P2002") {
            const err = new Error("Entry already exists for this date");
            err.code = "ENTRY_ALREADY_EXISTS";
            throw err;
        }
        throw e;
    }
}
export async function updateEntry(userId, date, patch) {
    const existing = await prisma.logEntry.findUnique({
        where: { userId_date: { userId, date } },
    });
    if (!existing) {
        const err = new Error("No entry exists for this date");
        err.code = "NOT_FOUND";
        throw err;
    }
    const updated = await prisma.logEntry.update({
        where: { id: existing.id },
        data: {
            painLevel: patch.painLevel,
            swellingLevel: patch.swellingLevel,
            notes: patch.notes,
            // ✅ Fix: Cast Record to InputJsonValue for Prisma
            details: (patch.details ?? existing.details ?? {}),
        },
    });
    return updated;
}
export async function listEntries(userId) {
    return prisma.logEntry.findMany({
        where: { userId },
        orderBy: { date: "asc" },
    });
}
export async function listEntriesInRange(userId, from, to) {
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
