import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Prisma, ActivationCodeStatus, UserRole } from "@prisma/client";
import { prisma } from "../../prisma/client.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
// ✅ FIX: Import matches the renamed export in generatePlan.ts
import { generatePlan } from "../../services/plan/generatePlan.js";
export const clinicRouter = Router();
// Secure ALL clinic routes
clinicRouter.use(requireAuth);
clinicRouter.use(requireRole([UserRole.CLINIC, UserRole.OWNER]));
/**
 * GET /clinic/batches
 */
clinicRouter.get("/batches", async (req, res) => {
    const limitRaw = String(req.query.limit ?? "");
    const limitNum = limitRaw ? Number(limitRaw) : 25;
    const limit = Number.isFinite(limitNum)
        ? Math.max(1, Math.min(200, Math.floor(limitNum)))
        : 25;
    const clinicTag = typeof req.query.clinicTag === "string" ? req.query.clinicTag.trim() : undefined;
    const where = clinicTag ? { clinicTag } : {};
    const batches = await prisma.activationBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            clinicTag: true,
            quantity: true,
            createdAt: true,
            createdByUserId: true,
        },
    });
    const batchIds = batches.map((b) => b.id);
    if (batchIds.length === 0)
        return res.status(200).json({ batches: [] });
    const totals = await prisma.activationCode.groupBy({
        by: ["batchId"],
        where: { batchId: { in: batchIds } },
        _count: { _all: true },
    });
    const byStatus = await prisma.activationCode.groupBy({
        by: ["batchId", "status"],
        where: { batchId: { in: batchIds } },
        _count: { _all: true },
    });
    const configured = await prisma.activationCode.groupBy({
        by: ["batchId"],
        where: {
            batchId: { in: batchIds },
            configJson: { not: Prisma.DbNull },
        },
        _count: { _all: true },
    });
    const readCountAll = (row) => row?._count?._all ?? 0;
    const totalByBatchId = new Map();
    totals.forEach((row) => {
        if (row.batchId)
            totalByBatchId.set(row.batchId, readCountAll(row));
    });
    const unusedByBatchId = new Map();
    const claimedByBatchId = new Map();
    byStatus.forEach((row) => {
        if (!row.batchId)
            return;
        if (row.status === ActivationCodeStatus.ISSUED)
            unusedByBatchId.set(row.batchId, readCountAll(row));
        if (row.status === ActivationCodeStatus.CLAIMED)
            claimedByBatchId.set(row.batchId, readCountAll(row));
    });
    const configuredByBatchId = new Map();
    configured.forEach((row) => {
        if (row.batchId)
            configuredByBatchId.set(row.batchId, readCountAll(row));
    });
    const withCounts = batches.map((b) => {
        const total = totalByBatchId.get(b.id) ?? 0;
        return {
            ...b,
            codeCounts: {
                total,
                unused: unusedByBatchId.get(b.id) ?? 0,
                claimed: claimedByBatchId.get(b.id) ?? 0,
                configured: configuredByBatchId.get(b.id) ?? 0,
                quantityMismatch: total !== b.quantity,
            },
        };
    });
    return res.status(200).json({ batches: withCounts });
});
// Helper for code generation
const CODE_PREFIX = "FR";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeActivationCode() {
    const bytes = crypto.randomBytes(8);
    let chunk1 = "";
    let chunk2 = "";
    for (let i = 0; i < 4; i++)
        chunk1 += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    for (let i = 4; i < 8; i++)
        chunk2 += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    return `${CODE_PREFIX}-${chunk1}-${chunk2}`;
}
const CreateBatchSchema = z.object({
    clinicTag: z.string().min(2).max(64),
    quantity: z.number().int().min(1).max(5000),
});
const ClinicActivationConfigSchema = z.object({
    config: z.record(z.any()), // Loose for generic configuration
});
clinicRouter.post("/batches", async (req, res) => {
    const userId = req.user.id;
    const parsed = CreateBatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
    const { clinicTag, quantity } = parsed.data;
    try {
        const batch = await prisma.$transaction(async (tx) => {
            await tx.clinicPlanConfig.upsert({
                where: { clinicTag },
                update: {},
                create: { clinicTag, overridesJson: Prisma.JsonNull },
            });
            const createdBatch = await tx.activationBatch.create({
                data: { id: crypto.randomUUID(), clinicTag, quantity, createdByUserId: userId },
            });
            let insertedTotal = 0;
            let safety = 0;
            while (insertedTotal < quantity && safety < 25) {
                safety++;
                const genCount = Math.min(quantity - insertedTotal, 2000);
                const data = Array.from({ length: genCount }).map(() => ({
                    code: makeActivationCode(),
                    clinicTag,
                    batchId: createdBatch.id,
                }));
                const created = await tx.activationCode.createMany({ data, skipDuplicates: true });
                insertedTotal += created.count;
            }
            return createdBatch;
        });
        return res.status(201).json({ batch });
    }
    catch (e) {
        return res.status(500).json({ code: "UNKNOWN_ERROR" });
    }
});
/**
 * Approved Snapshot Logic
 */
clinicRouter.post("/activation/:code/approve", async (req, res) => {
    const requesterTag = req.user?.clinicTag;
    const code = String(req.params.code ?? "").trim();
    const activation = await prisma.activationCode.findUnique({ where: { code } });
    if (!activation)
        return res.status(404).json({ code: "NOT_FOUND" });
    if (!requesterTag || activation.clinicTag !== requesterTag)
        return res.status(403).json({ code: "FORBIDDEN" });
    const clinicConfig = await prisma.clinicPlanConfig.findUnique({ where: { clinicTag: requesterTag } });
    // ✅ FIX: Use generatePlan (renamed export)
    const { planJson } = generatePlan({
        clinicOverridesJson: clinicConfig?.overridesJson,
        config: activation.configJson,
        category: "general"
    });
    const updated = await prisma.activationCode.update({
        where: { id: activation.id },
        data: {
            status: ActivationCodeStatus.APPROVED,
            // ✅ FIX: Matches the new field in schema.prisma
            planSnapshot: planJson
        },
        select: { code: true, status: true },
    });
    return res.status(200).json({ ok: true, activation: updated });
});
/**
 * ✅ FIX: Updated relation names to match new schema.prisma
 */
clinicRouter.get("/patients", async (req, res) => {
    const requesterTag = req.user?.clinicTag ?? null;
    if (!requesterTag)
        return res.status(403).json({ code: "FORBIDDEN" });
    const patients = await prisma.activationCode.findMany({
        where: {
            clinicTag: requesterTag,
            status: ActivationCodeStatus.CLAIMED,
            claimedByUserId: { not: null }
        },
        select: {
            code: true,
            claimedAt: true,
            claimedByUser: {
                select: {
                    id: true,
                    email: true,
                    recoveryPlan: {
                        select: {
                            startDate: true,
                            // Note: currentDay might need to be calculated or 
                            // added to instance if needed by your UI
                            createdAt: true
                        }
                    }
                }
            }
        },
        orderBy: { claimedAt: 'desc' }
    });
    const flatPatients = patients.map(p => ({
        id: p.claimedByUser?.id,
        email: p.claimedByUser?.email,
        code: p.code,
        joinedAt: p.claimedAt,
        startDate: p.claimedByUser?.recoveryPlan?.startDate
    }));
    return res.status(200).json({ patients: flatPatients });
});
// ... [Batch code export and Preview routes remain largely same, 
// ensure they use generatePlan instead of generateRecoveryPlan]
