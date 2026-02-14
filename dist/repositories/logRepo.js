import { prisma } from "../prisma/client.js";
// Import the new encryption utilities
import { encryptPHI, decryptPHI } from "../utils/encryption.js";
export async function createEntry(userId, entry) {
    try {
        // ENCRYPTION: Protect notes before DB insertion
        const secureNotes = encryptPHI(entry.notes);
        const stored = await prisma.logEntry.create({
            data: {
                userId,
                date: entry.date,
                painLevel: entry.painLevel,
                swellingLevel: entry.swellingLevel,
                notes: secureNotes, // <--- Encrypted
                // Fix: Cast Record to InputJsonValue for Prisma
                details: (entry.details || {}),
                schemaVersion: entry.schemaVersion ?? 2,
            },
        });
        // DECRYPTION: Return readable data to the caller (so the UI updates immediately)
        return { ...stored, notes: decryptPHI(stored.notes) };
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
    // ENCRYPTION: Only encrypt if notes are being updated
    // We use a ternary to strictly preserve 'undefined' (do not update) vs 'null' (clear field)
    const secureNotes = patch.notes !== undefined ? encryptPHI(patch.notes) : undefined;
    const updated = await prisma.logEntry.update({
        where: { id: existing.id },
        data: {
            painLevel: patch.painLevel,
            swellingLevel: patch.swellingLevel,
            notes: secureNotes, // <--- Encrypted (or undefined to skip)
            // Fix: Cast Record to InputJsonValue for Prisma
            details: (patch.details ?? existing.details ?? {}),
        },
    });
    // DECRYPTION: Return cleartext
    return { ...updated, notes: decryptPHI(updated.notes) };
}
export async function listEntries(userId) {
    const rawEntries = await prisma.logEntry.findMany({
        where: { userId },
        orderBy: { date: "asc" },
    });
    // DECRYPTION: Decrypt all notes before returning list
    return rawEntries.map(entry => ({
        ...entry,
        notes: decryptPHI(entry.notes)
    }));
}
export async function listEntriesInRange(userId, from, to) {
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
    return rawEntries.map(entry => ({
        ...entry,
        notes: decryptPHI(entry.notes)
    }));
}
