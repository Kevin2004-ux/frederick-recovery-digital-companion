// app/backend/src/utils/requireUser.ts
// Small helper to make TS happy and keep auth failures consistent.

import type { Request, Response } from "express";

export function getUserIdOrRespond(req: Request, res: Response): string | null {
  const userId = req.user?.id;

  if (!userId) {
    // Canonical auth failure response for routes
    res.status(401).json({ code: "UNAUTHORIZED" });
    return null;
  }

  return userId;
}
