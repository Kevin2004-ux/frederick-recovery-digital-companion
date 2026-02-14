// app/backend/src/routes/activation/index.ts
import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { signAccessToken } from "../../utils/jwt.js";
import { AuditService, AuditCategory, AuditStatus } from "../../services/AuditService.js";
import { ActivationCodeStatus, UserRole } from "@prisma/client";

export const activationRouter = Router();

// POST /activation/claim
// Patient enters code + email + password to create account
activationRouter.post("/claim", async (req: Request, res: Response) => {
  const Schema = z.object({
    code: z.string().min(5),
    email: z.string().email(),
    password: z.string().min(12)
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { code, email, password } = parsed.data;

  try {
    // 1. Verify Code exists and is usable
    const activation = await prisma.activationCode.findUnique({ where: { code } });
    
    if (!activation) {
      return res.status(404).json({ code: "INVALID_CODE" });
    }

    if (activation.status !== ActivationCodeStatus.ISSUED && activation.status !== ActivationCodeStatus.DRAFT && activation.status !== ActivationCodeStatus.APPROVED) {
      return res.status(409).json({ code: "CODE_ALREADY_USED" });
    }

    // 2. Check if email is taken
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ code: "EMAIL_TAKEN" });
    }

    // 3. Create User & Claim Code (Transaction)
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // A. Create User
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.PATIENT,
          tokenVersion: 1, // Initialize security version
          clinicTag: activation.clinicTag, // Link patient to clinic automatically
        }
      });

      // B. Mark Code as Claimed
      await tx.activationCode.update({
        where: { id: activation.id },
        data: {
          status: ActivationCodeStatus.CLAIMED,
          claimedByUserId: newUser.id,
          claimedAt: new Date()
        }
      });

      // C. Copy Plan Config if exists (Optional logic)
      if (activation.configJson) {
         // Logic to create initial plan could go here
      }

      return newUser;
    });

    // 4. Issue Token (With Security Version!)
    const token = signAccessToken({
      sub: result.id,
      email: result.email,
      role: result.role,
      tokenVersion: result.tokenVersion // <--- THE FIX
    });

    // 5. Audit
    AuditService.log({
      req,
      category: AuditCategory.AUTH,
      type: "ACTIVATION_CLAIM_SUCCESS",
      userId: result.id,
      role: result.role,
      status: AuditStatus.SUCCESS,
      targetId: code,
      metadata: { clinicTag: activation.clinicTag }
    });

    return res.status(201).json({ 
      token, 
      user: { id: result.id, email: result.email, role: result.role } 
    });

  } catch (err) {
    console.error("Activation Claim Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});