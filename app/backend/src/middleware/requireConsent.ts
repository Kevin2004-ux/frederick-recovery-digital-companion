// app/backend/src/middleware/requireOnboarding.ts
import type { Request, Response, NextFunction } from "express";
import { findUserById } from "../repositories/userRepo.js";

export function requireOnboarding(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  const user = findUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  if (!user.procedureCode || !user.recoveryStartDate) {
    return res.status(403).json({ code: "ONBOARDING_REQUIRED" });
  }

  return next();
}
