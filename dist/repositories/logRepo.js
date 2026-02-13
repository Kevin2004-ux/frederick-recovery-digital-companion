// app/backend/src/repositories/logRepo.ts
// In-memory Recovery Log repository (no DB yet)
const entriesByUserAndDate = new Map();
function keyFor(userId, date) {
    return `${userId}:${date}`;
}
/**
 * Create a log entry for a user on a date.
 * One per date per user.
 *
 * schemaVersion defaults to 1 unless explicitly provided.
 */
export function createEntry(userId, entry) {
    const key = keyFor(userId, entry.date);
    if (entriesByUserAndDate.has(key)) {
        const err = new Error("Entry already exists for this date");
        // @ts-expect-error lightweight error code
        err.code = "ENTRY_ALREADY_EXISTS";
        throw err;
    }
    const stored = {
        ...entry,
        schemaVersion: entry.schemaVersion ?? 1,
    };
    entriesByUserAndDate.set(key, stored);
    return { ...stored };
}
/**
 * Update-only: update an existing entry for a user/date.
 * schemaVersion is preserved.
 */
export function updateEntry(userId, date, patch) {
    const key = keyFor(userId, date);
    const existing = entriesByUserAndDate.get(key);
    if (!existing) {
        const err = new Error("No entry exists for this date");
        // @ts-expect-error lightweight error code
        err.code = "NOT_FOUND";
        throw err;
    }
    const updated = {
        ...existing,
        painLevel: patch.painLevel,
        swellingLevel: patch.swellingLevel,
        notes: patch.notes,
        details: patch.details ?? existing.details,
        schemaVersion: existing.schemaVersion,
    };
    entriesByUserAndDate.set(key, updated);
    return { ...updated };
}
/**
 * List all entries for a user, sorted by date ascending.
 */
export function listEntries(userId) {
    const out = [];
    for (const [k, v] of entriesByUserAndDate.entries()) {
        if (k.startsWith(`${userId}:`))
            out.push({ ...v });
    }
    out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return out;
}
/**
 * Clear all entries (dev/testing only).
 */
export function _dangerouslyClearAll() {
    entriesByUserAndDate.clear();
}
