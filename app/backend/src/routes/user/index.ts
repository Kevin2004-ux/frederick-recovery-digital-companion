// app/backend/src/routes/user/index.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireConsent } from "../../middleware/requireConsent.js";
import { getUserProfile, updateUserProfile } from "../../repositories/userRepo.js";

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.use(requireConsent);

const profileSchema = z.object({
  procedureName: z.string().min(1).optional(),
  procedureCode: z.string().min(1).optional(), // legacy compatibility
  recoveryStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

userRouter.get("/profile", async (req, res) => {
  try {
    const profile = await getUserProfile(req.user!.id);
    return res.status(200).json({ profile });
  } catch {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
});

userRouter.put("/profile", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // Normalize: prefer procedureName, fall back to legacy procedureCode
  const procedureName = parsed.data.procedureName ?? parsed.data.procedureCode;

  if (!procedureName) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: [
        {
          path: "procedureName",
          message: "Procedure name is required",
        },
      ],
    });
  }

  try {
    const profile = await updateUserProfile(req.user!.id, {
      procedureName,
      recoveryStartDate: parsed.data.recoveryStartDate,
    });

    return res.status(200).json({ profile });
  } catch {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
});
