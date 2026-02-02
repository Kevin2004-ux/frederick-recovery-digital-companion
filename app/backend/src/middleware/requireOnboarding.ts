// app/backend/src/middleware/requireOnboarding.ts
import type { NextFunction, Request, Response } from "express";
import { findUserById } from "../repositories/userRepo.js";

export function requireOnboarding(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  const user = findUserById(userId);
  if (!user) {
    // In-memory reset => token refers to a user that no longer exists
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  // Canonical: procedureName. Back-compat: procedureCode.
  const procedureName = user.procedureName ?? user.procedureCode;

  if (!procedureName || !user.recoveryStartDate) {
    return res.status(403).json({ code: "ONBOARDING_REQUIRED" });
  }

  return next();
}
