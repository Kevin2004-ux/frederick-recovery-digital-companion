// app/backend/src/routes/log/index.ts
import { Router } from "express";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireConsent } from "../../middleware/requireConsent.js";
import { requireOnboarding } from "../../middleware/requireOnboarding.js";
import { requireRole } from "../../middleware/requireRole.js";
import { createEntry, listEntries, updateEntry, listEntriesInRange } from "../../repositories/logRepo.js";
import { getUserIdOrRespond } from "../../utils/requireUser.js";
// Update import to include AuditSeverity
import { AuditService, AuditCategory, AuditStatus, AuditSeverity } from "../../services/AuditService.js";
import { PdfService } from "../../services/export/PdfService.js";

export const logRouter = Router();

// SECURITY: Guard everything under /log. Clinics are strictly forbidden here!
logRouter.use(requireAuth);
logRouter.use(requireRole([UserRole.PATIENT]));
logRouter.use(requireConsent);
logRouter.use(requireOnboarding);

const baseEntrySchema = {
  painLevel: z.number().int().min(1).max(10),
  swellingLevel: z.number().int().min(1).max(10),
  notes: z.string().max(5000).optional(),
};

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  schemaVersion: z.number().int().positive().optional(),
  ...baseEntrySchema,
  details: z.record(z.unknown()).optional(),
});

const updateEntrySchema = z.object({
  ...baseEntrySchema,
  details: z.record(z.unknown()).optional(),
});

const dateQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * POST /log/entries
 */
logRouter.post("/entries", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  try {
    const created = await createEntry(userId, parsed.data);
    
    // HIPAA AUDIT: Log creation
    // We don't await this strictly because failing to log creation isn't a data leak
    AuditService.log({
      req, category: AuditCategory.LOG, type: "PHI_CREATED",
      userId, role: req.user!.role, patientUserId: userId,
      targetId: created.id, targetType: "LogEntry", status: AuditStatus.SUCCESS
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "ENTRY_ALREADY_EXISTS") {
      return res.status(409).json({ code: "ENTRY_ALREADY_EXISTS", message: "An entry already exists for this date" });
    }
    return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to create log entry" });
  }
});

/**
 * PUT /log/entries/:date
 */
logRouter.put("/entries/:date", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsedParams = dateParamSchema.safeParse(req.params);
  if (!parsedParams.success) return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedParams.error.issues });

  const parsedBody = updateEntrySchema.safeParse(req.body);
  if (!parsedBody.success) return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedBody.error.issues });

  try {
    const updated = await updateEntry(userId, parsedParams.data.date, parsedBody.data);
    
    // HIPAA AUDIT: Log update
    AuditService.log({
      req, category: AuditCategory.LOG, type: "PHI_UPDATED",
      userId, role: req.user!.role, patientUserId: userId,
      targetId: updated.id, targetType: "LogEntry", status: AuditStatus.SUCCESS
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") {
      return res.status(404).json({ code: "NOT_FOUND", message: "No entry exists for this date" });
    }
    return res.status(500).json({ code: "INTERNAL_ERROR", message: "Failed to update log entry" });
  }
});

/**
 * GET /log/entries
 */
logRouter.get("/entries", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const parsedQuery = dateQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsedQuery.error.issues });

  const { from, to } = parsedQuery.data;
  const entries = await listEntriesInRange(userId, from, to);

  // HIPAA AUDIT: Data View
  AuditService.log({
    req, category: AuditCategory.LOG, type: "PHI_VIEWED",
    userId, role: req.user!.role, patientUserId: userId, status: AuditStatus.SUCCESS,
    metadata: { count: entries.length, from, to }
  });

  return res.json(entries);
});

/**
 * GET /log/entries/export (JSON)
 */
logRouter.get("/entries/export", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  try {
    const entries = await listEntries(userId);

    // CRITICAL AUDIT: Fail-Closed
    // We await this. If it fails (throws), we jump to catch and DO NOT send data.
    await AuditService.log({
      req, category: AuditCategory.LOG, type: "PHI_EXPORTED",
      userId, role: req.user!.role, patientUserId: userId, status: AuditStatus.SUCCESS,
      metadata: { format: "JSON", count: entries.length },
      severity: AuditSeverity.CRITICAL
    });

    const payload = { exportedAt: new Date().toISOString(), userId, entries };
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.json"');
    return res.status(200).send(JSON.stringify(payload, null, 2));

  } catch (error) {
    console.error("Export blocked due to audit failure", error);
    return res.status(500).json({ code: "AUDIT_FAILURE", message: "Security audit failed. Export blocked." });
  }
});

/**
 * GET /log/entries/export.csv
 */
logRouter.get("/entries/export.csv", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  try {
    const entries = await listEntries(userId);

    // CRITICAL AUDIT: Fail-Closed
    await AuditService.log({
      req, category: AuditCategory.LOG, type: "PHI_EXPORTED",
      userId, role: req.user!.role, patientUserId: userId, status: AuditStatus.SUCCESS,
      metadata: { format: "CSV", count: entries.length },
      severity: AuditSeverity.CRITICAL
    });

    const escapeCsv = (value: unknown) => {
      const s = String(value ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = ["date", "painLevel", "swellingLevel", "notes", "schemaVersion"].join(",");
    const rows = entries.map((e) =>
      [e.date, e.painLevel, e.swellingLevel, e.notes ?? "", e.schemaVersion].map(escapeCsv).join(",")
    );

    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.csv"');
    return res.status(200).send(csv);

  } catch (error) {
    console.error("Export blocked due to audit failure", error);
    return res.status(500).json({ code: "AUDIT_FAILURE", message: "Security audit failed. Export blocked." });
  }
});

/**
 * GET /log/entries/export.pdf
 */
logRouter.get("/entries/export.pdf", async (req, res) => {
  const userId = getUserIdOrRespond(req, res);
  if (!userId) return;

  const userEmail = req.user!.email; // Safe because requireAuth is active

  try {
    const entries = await listEntries(userId);

    // CRITICAL AUDIT: Fail-Closed
    await AuditService.log({
      req, category: AuditCategory.LOG, type: "PHI_EXPORTED",
      userId, role: req.user!.role, patientUserId: userId, status: AuditStatus.SUCCESS,
      metadata: { format: "PDF", count: entries.length },
      severity: AuditSeverity.CRITICAL
    });

    // Set Headers only after audit succeeds
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="recovery-log.pdf"');
    
    await PdfService.streamLogReport(entries, res, userEmail);

  } catch (error) {
    console.error("Export blocked due to audit failure", error);
    if (!res.headersSent) {
      return res.status(500).json({ code: "AUDIT_FAILURE", message: "Security audit failed. Export blocked." });
    }
  }
});