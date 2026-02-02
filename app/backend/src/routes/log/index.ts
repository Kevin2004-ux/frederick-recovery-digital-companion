// app/backend/src/routes/log/index.ts
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireConsent } from "../../middleware/requireConsent.js";
import { requireOnboarding } from "../../middleware/requireOnboarding.js";

import { createEntry, listEntries, updateEntry, type RecoveryLogEntry } from "../../repositories/logRepo.js";
import { getUserIdOrRespond } from "../../utils/requireUser.js";
import { prisma } from "../../db/prisma.js";

export const logRouter = Router();

// Guard everything under /log
logRouter.use(requireAuth, requireConsent, requireOnboarding);

/**
 * Existing stub (keep it, still protected)
 * GET /log
 */
logRouter.get("/", (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  return res.json({
    ok: true,
    message: "Log access granted",
    userId,
  });
});

const baseEntrySchema = {
  painLevel: z.number().int().min(1).max(10),
  swellingLevel: z.number().int().min(1).max(10),
  notes: z.string().max(5000).optional(),
};

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),

  // Optional: backend/repo will default to 1 if omitted
  schemaVersion: z.number().int().positive().optional(),

  ...baseEntrySchema,

  // ✅ NEW — extended wizard data for schemaVersion 2+
  details: z.record(z.unknown()).optional(),
});

const updateEntrySchema = z.object({
  ...baseEntrySchema,

  // ✅ NEW — allow updating details too (schemaVersion preserved in repo)
  details: z.record(z.unknown()).optional(),
});

const dateQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// DB-backed range list that preserves the same return shape as listEntries()
async function listEntriesInRange(
  userId: string,
  from?: string,
  to?: string
): Promise<RecoveryLogEntry[]> {
  // If no range filter, use the repo function as-is (single source of truth)
  if (!from && !to) return await listEntries(userId);

const rows: {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes: string | null;
  schemaVersion: number;
  details: unknown | null;
}[] = await prisma.logEntry.findMany({
    where: {
      userId,
      date: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      painLevel: true,
      swellingLevel: true,
      notes: true,
      schemaVersion: true,
      details: true,
    },
  });

  return rows.map((r) => ({
    date: r.date,
    painLevel: r.painLevel,
    swellingLevel: r.swellingLevel,
    notes: r.notes ?? undefined,
    schemaVersion: r.schemaVersion,
    details: (r.details ?? undefined) as any,
  }));
}

/**
 * POST /log/entries
 * Creates an entry for a given date (one per date per user).
 */
logRouter.post("/entries", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues,
    });
  }

  try {
    const created = await createEntry(userId, parsed.data);
    return res.status(201).json(created);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "ENTRY_ALREADY_EXISTS") {
      return res.status(409).json({
        code: "ENTRY_ALREADY_EXISTS",
        message: "An entry already exists for this date",
      });
    }

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to create log entry",
    });
  }
});

/**
 * PUT /log/entries/:date
 * Update-only: updates the existing entry for that date.
 */
logRouter.put("/entries/:date", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsedParams = dateParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsedParams.error.issues,
    });
  }

  const parsedBody = updateEntrySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsedBody.error.issues,
    });
  }

  try {
    const updated = await updateEntry(userId, parsedParams.data.date, parsedBody.data);
    return res.status(200).json(updated);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === "NOT_FOUND") {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "No entry exists for this date",
      });
    }

    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to update log entry",
    });
  }
});

/**
 * GET /log/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Lists entries (sorted by date asc), optionally filtered by inclusive date range.
 *
 * IMPORTANT: returns an ARRAY (not wrapped) to match the frontend/client contract.
 */
logRouter.get("/entries", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsedQuery = dateQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsedQuery.error.issues,
    });
  }

  const { from, to } = parsedQuery.data;

  const entries = await listEntriesInRange(userId, from, to);
  return res.json(entries);
});

/**
 * GET /log/entries/export
 * Downloads the user's entries as a JSON file.
 */
logRouter.get("/entries/export", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const entries = await listEntries(userId);

  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    entries,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.json"');

  return res.status(200).send(JSON.stringify(payload, null, 2));
});

/**
 * GET /log/entries/export.csv
 * Downloads the user's entries as a CSV file.
 */
logRouter.get("/entries/export.csv", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const entries = await listEntries(userId);

  const escapeCsv = (value: unknown) => {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = ["date", "painLevel", "swellingLevel", "notes", "schemaVersion"].join(",");

  const rows = entries.map((e) =>
    [e.date, e.painLevel, e.swellingLevel, e.notes ?? "", e.schemaVersion]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.csv"');

  return res.status(200).send(csv);
});
