// app/backend/src/routes/log/index.ts
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../../middleware/requireAuth.js";
import { requireConsent } from "../../middleware/requireConsent.js";
import { requireOnboarding } from "../../middleware/requireOnboarding.js";

import { createEntry, listEntries } from "../../repositories/logRepo.js";
import { getUserIdOrRespond } from "../../utils/requireUser.js";

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

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  painLevel: z.number().int().min(1).max(10),
  swellingLevel: z.number().int().min(1).max(10),
  notes: z.string().max(5000).optional(),

  // Optional: backend/repo will default to 1 if omitted
  schemaVersion: z.number().int().positive().optional(),
});

const dateQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /log/entries
 * Creates an immutable entry for a given date (one per date per user).
 */
logRouter.post("/entries", (req, res) => {
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
    const created = createEntry(userId, parsed.data);
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "ENTRY_ALREADY_EXISTS") {
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
 * GET /log/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Lists entries (sorted by date asc), optionally filtered by inclusive date range.
 */
logRouter.get("/entries", (req, res) => {
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

  let entries = listEntries(userId);
  if (from) entries = entries.filter((e) => e.date >= from);
  if (to) entries = entries.filter((e) => e.date <= to);

  return res.json({ entries });
});

/**
 * GET /log/entries/export
 * Downloads the user's entries as a JSON file.
 */
logRouter.get("/entries/export", (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const entries = listEntries(userId);

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
logRouter.get("/entries/export.csv", (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const entries = listEntries(userId);

  const escapeCsv = (value: unknown) => {
    const s = String(value ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  // Include schemaVersion so exports are self-describing
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
