// app/backend/src/middleware/requireConsent.ts
import type { Request, Response, NextFunction } from "express";
import { findUserById } from "../repositories/userRepo.js";

export async function requireConsent(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ code: "UNAUTHORIZED" });

  const user = await findUserById(userId);
  if (!user) return res.status(401).json({ code: "UNAUTHORIZED" });

  if (!user.consentAcceptedAt) {
    return res.status(403).json({ code: "CONSENT_REQUIRED" });
  }

  return next();
}
