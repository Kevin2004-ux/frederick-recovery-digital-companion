// app/backend/src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js"; // Ensure this matches your actual prisma export path
import { UserRole } from "@prisma/client";

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
    // A. Verify Signature
    // We use standard jwt.verify to ensure we catch expiration/tampering
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; userId?: string };
    
    // Support both 'sub' (standard) and 'userId' (custom) claim formats
    const targetId = decoded.sub || decoded.userId;

    // B. DATABASE CHECK (The Security Fix)
    // We look up the user FRESH from the database every time.
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { 
        id: true, 
        email: true, 
        role: true, 
        clinicTag: true,
        // Security fields
        isBanned: true,
        lockedUntil: true 
      }
    });

    // C. Security Gates
    if (!user) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "User no longer exists" });
    }

    if (user.isBanned) {
      return res.status(403).json({ code: "ACCOUNT_TERMINATED", message: "This account has been permanently banned." });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ code: "ACCOUNT_LOCKED", message: "Account is temporarily locked. Try again later." });
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