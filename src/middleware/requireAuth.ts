import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../db/prisma.js";
import { UserRole } from "@prisma/client"; // <--- Import real Enum

// Extend Express Request type to include our User with strict typing
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole; // <--- Uses real Enum now
        clinicTag?: string | null;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }

  try {
    const payload = verifyAccessToken(token);

    // Optional: Check DB to ensure user wasn't banned/deleted since token issue
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, clinicTag: true }
    });

    if (!user) {
      return res.status(401).json({ code: "UNAUTHORIZED" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role, // <--- Now matches strict UserRole type
      clinicTag: user.clinicTag
    };

    next();
  } catch (err) {
    return res.status(401).json({ code: "UNAUTHORIZED" });
  }
}