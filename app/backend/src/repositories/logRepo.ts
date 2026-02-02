// app/backend/src/repositories/logRepo.ts
// In-memory Recovery Log repository (no DB yet)

export type RecoveryLogEntry = {
  date: string; // YYYY-MM-DD

  // Core metrics (always present, even in v2)
  painLevel: number; // 1–10
  swellingLevel: number; // 1–10
  notes?: string;

  // Questionnaire version
  schemaVersion: number;

  // NEW — extended questionnaire data (schemaVersion >= 2)
  details?: Record<string, unknown>;
};

type EntryKey = `${string}:${string}`; // `${userId}:${date}`

const entriesByUserAndDate = new Map<EntryKey, RecoveryLogEntry>();

function keyFor(userId: string, date: string): EntryKey {
  return `${userId}:${date}`;
}

/**
 * Create a log entry for a user on a date.
 * One per date per user.
 *
 * schemaVersion defaults to 1 unless explicitly provided.
 */
export function createEntry(
  userId: string,
  entry: Omit<RecoveryLogEntry, "schemaVersion"> & { schemaVersion?: number }
): RecoveryLogEntry {
  const key = keyFor(userId, entry.date);
  if (entriesByUserAndDate.has(key)) {
    const err = new Error("Entry already exists for this date");
    // @ts-expect-error lightweight error code
    err.code = "ENTRY_ALREADY_EXISTS";
    throw err;
  }

  const stored: RecoveryLogEntry = {
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
export function updateEntry(
  userId: string,
  date: string,
  patch: Pick<RecoveryLogEntry, "painLevel" | "swellingLevel" | "details"> & {
    notes?: string;
  }
): RecoveryLogEntry {
  const key = keyFor(userId, date);
  const existing = entriesByUserAndDate.get(key);

  if (!existing) {
    const err = new Error("No entry exists for this date");
    // @ts-expect-error lightweight error code
    err.code = "NOT_FOUND";
    throw err;
  }

  const updated: RecoveryLogEntry = {
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
export function listEntries(userId: string): RecoveryLogEntry[] {
  const out: RecoveryLogEntry[] = [];

  for (const [k, v] of entriesByUserAndDate.entries()) {
    if (k.startsWith(`${userId}:`)) out.push({ ...v });
  }

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/**
 * Clear all entries (dev/testing only).
 */
export function _dangerouslyClearAll(): void {
  entriesByUserAndDate.clear();
}
