// app/backend/src/middleware/requireConsent.ts
import type { Request, Response, NextFunction } from "express";
import { findUserById } from "../repositories/userRepo.js";

export function requireConsent(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  const user = findUserById(req.user.id);
  if (!user) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  if (!user.consentAcceptedAt) {
    return res.status(403).json({ code: "CONSENT_REQUIRED" });
  }

  return next();
}
