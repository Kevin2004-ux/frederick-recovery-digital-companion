// app/backend/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// 1. Define the shape of the decoded token
interface DecodedToken {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// 2. Extend Express Request to include user
// This prevents us from having to use (req as any) everywhere
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

/**
 * Validates the JWT in the Authorization header.
 * Attaches user data (id, role) to req.user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  // Format: "Bearer <token>"
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next(); // Pass control to the next handler
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

/**
 * Optional: Middleware to restrict access to specific roles.
 * Usage: router.get("/admin", requireAuth, requireRole("ADMIN"), adminController);
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    next();
  };
}