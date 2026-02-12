// app/backend/src/middleware/requireOnboarding.ts
import type { Request, Response, NextFunction } from "express";
import { findUserById } from "../repositories/userRepo.js";

export async function requireOnboarding(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const user = await findUserById(userId);
  if (!user) return res.status(401).json({ code: "UNAUTHORIZED" });

  // Compatibility: procedureName preferred; fallback to legacy procedureCode
  const procedureName = user.procedureName ?? user.procedureCode;

  if (!procedureName || !user.recoveryStartDate) {
    return res.status(403).json({ code: "ONBOARDING_REQUIRED" });
  }

  return next();
}
