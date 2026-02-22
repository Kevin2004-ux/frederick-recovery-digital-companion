// app/backend/src/routes/admin/index.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { ActivationCodeStatus, UserRole } from "@prisma/client";
import { AuditService, AuditCategory, AuditStatus, AuditSeverity } from "../../services/AuditService.js";

export const adminRouter = Router();

// 🔒 OWNER ONLY
adminRouter.use(requireAuth);
adminRouter.use(requireRole([UserRole.OWNER]));

// Extra lock: Kevin-only
adminRouter.use((req, res, next) => {
  const u = req.user;
  if (!u || u.role !== UserRole.OWNER || u.email?.toLowerCase() !== "kevin.frederick987@gmail.com") {
    return res.status(403).json({ code: "FORBIDDEN" });
  }
  next();
});

const CreateClinicSchema = z.object({
  name: z.string().min(2),
  clinicTag: z.string().min(3).regex(/^[A-Za-z0-9-]+$/, "Alphanumeric and dashes only"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(12),
});

/**
 * POST /admin/clinics
 * Provision clinic + first clinic admin user in one atomic transaction.
 */
adminRouter.post("/clinics", async (req: Request, res: Response) => {
  const parsed = CreateClinicSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { name, clinicTag, adminEmail, adminPassword } = parsed.data;

  try {
    const existing = await prisma.clinicPlanConfig.findUnique({ where: { clinicTag } });
    if (existing) return res.status(409).json({ code: "CLINIC_TAG_EXISTS" });

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinicPlanConfig.create({
        data: { clinicTag, name, defaultCategory: "general_outpatient" },
      });

      const user = await tx.user.create({
        data: {
          email: adminEmail.toLowerCase(),
          passwordHash,
          role: UserRole.CLINIC,
          clinicTag,
          emailVerifiedAt: new Date(), // Owner-provisioned
        },
        select: { id: true, email: true, role: true, clinicTag: true },
      });

      return { clinic, user };
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "CLINIC_PROVISIONED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: result.clinic.clinicTag,
      metadata: { newClinicTag: clinicTag, newClinicName: name, newAdminEmail: adminEmail },
      severity: AuditSeverity.INFO,
    });

    return res.status(201).json({ ok: true, clinic: result.clinic, adminUser: result.user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

/**
 * GET /admin/clinics
 * List clinics for admin dashboard.
 */
adminRouter.get("/clinics", async (req: Request, res: Response) => {
  const clinics = await prisma.clinicPlanConfig.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { activationCodes: true } },
    },
  });

  return res.json({ clinics });
});

/**
 * DELETE /admin/clinics/:clinicTag
 * Hard-delete a clinic + its unclaimed codes/admin users.
 * Safety: blocks delete if any activation codes are CLAIMED.
 */
adminRouter.delete("/clinics/:clinicTag", async (req: Request, res: Response) => {
  const clinicTag = String(req.params.clinicTag || "").trim();

  // Basic validation (same rules as creation)
  if (!clinicTag || clinicTag.length < 3 || !/^[A-Za-z0-9-]+$/.test(clinicTag)) {
    return res.status(400).json({ code: "VALIDATION_ERROR" });
  }

  const clinic = await prisma.clinicPlanConfig.findUnique({ where: { clinicTag } });
  if (!clinic) return res.status(404).json({ code: "NOT_FOUND" });

  // Block if any codes are claimed (patient linkage exists)
  const claimedCount = await prisma.activationCode.count({
    where: { clinicTag, status: ActivationCodeStatus.CLAIMED },
  });

  if (claimedCount > 0) {
    return res.status(409).json({ code: "CLINIC_HAS_CLAIMED_CODES" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // delete dependents first
      await tx.activationCode.deleteMany({ where: { clinicTag } });

      // delete clinic users (admin accounts created during provisioning)
      await tx.user.deleteMany({ where: { clinicTag, role: UserRole.CLINIC } });

      // delete clinic record
      await tx.clinicPlanConfig.delete({ where: { clinicTag } });
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "CLINIC_DELETED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag,
      targetId: clinicTag,
      targetType: "Clinic",
      severity: AuditSeverity.WARN,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

/**
 * GET /admin/codes/:code
 * Global activation code lookup.
 */
adminRouter.get("/codes/:code", async (req: Request, res: Response) => {
  const code = req.params.code;

  const activation = await prisma.activationCode.findUnique({
    where: { code },
    include: {
      claimedByUser: { select: { id: true, email: true } },
    },
  });

  if (!activation) return res.status(404).json({ code: "NOT_FOUND" });
  return res.json({ activation });
});

/**
 * POST /admin/codes/:code/invalidate
 * Invalidate a code (lost/stolen/misprint).
 */
adminRouter.post("/codes/:code/invalidate", async (req: Request, res: Response) => {
  const code = req.params.code;

  try {
    const activation = await prisma.activationCode.update({
      where: { code },
      data: { status: ActivationCodeStatus.INVALIDATED },
      select: { code: true, status: true, clinicTag: true },
    });

    await AuditService.log({
      req,
      category: AuditCategory.ADMIN,
      type: "CODE_INVALIDATED",
      status: AuditStatus.SUCCESS,
      userId: req.user!.id,
      role: req.user!.role,
      clinicTag: activation.clinicTag,
      targetId: code,
      targetType: "ActivationCode",
      severity: AuditSeverity.WARN,
    });

    return res.json({ ok: true, code: activation.code, status: activation.status });
  } catch (err) {
    return res.status(404).json({ code: "NOT_FOUND" });
  }
});