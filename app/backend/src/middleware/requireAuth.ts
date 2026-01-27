// app/backend/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    return next();
  } catch {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }
}
