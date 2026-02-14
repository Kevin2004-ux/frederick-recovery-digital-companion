// app/backend/src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { UserRole } from "@prisma/client";
import { verifyAccessToken } from "../utils/jwt.js";

// 1. Type Extension
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        clinicTag: string | null;
      };
    }
  }
}

// 2. The Strict Middleware
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Check format "Bearer <token>"
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing or invalid token format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // A. Verify Signature & Expiration
    const payload = verifyAccessToken(token);

    // B. DATABASE CHECK (The Security Fix)
    // We look up the user FRESH from the database every time.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        clinicTag: true,
        // Security fields
        tokenVersion: true,
        isBanned: true,
        lockedUntil: true
      }
    });

    // C. Security Gates
    if (!user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "User no longer exists" });
    }

    // Gate 1: Banned Users
    if (user.isBanned) {
      return res.status(403).json({ code: "ACCOUNT_TERMINATED", message: "This account has been permanently banned." });
    }

    // Gate 2: Locked Users
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ code: "ACCOUNT_LOCKED", message: "Account is temporarily locked. Try again later." });
    }

    // Gate 3: Token Version Mismatch (Zombie Session Protection)
    // If the token has no version (old tokens) or a mismatching version, reject it.
    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ code: "TOKEN_REVOKED", message: "Session expired or password changed. Please login again." });
    }

    // D. Attach User to Request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      clinicTag: user.clinicTag
    };

    next();
  } catch (err) {
    // Token is expired or invalid
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}