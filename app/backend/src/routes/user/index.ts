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
  procedureCode: z.string().min(1, "procedureCode is required"),
  recoveryStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "recoveryStartDate must be YYYY-MM-DD"),
});

userRouter.get("/profile", (req, res) => {
  try {
    const profile = getUserProfile(req.user!.id);
    return res.status(200).json({ profile });
  } catch {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
});

userRouter.put("/profile", (req, res) => {
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

  try {
    const profile = updateUserProfile(req.user!.id, parsed.data);
    return res.status(200).json({ profile });
  } catch {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
});
