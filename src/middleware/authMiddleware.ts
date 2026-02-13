import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client'; // Import the source of truth from Prisma
import { getEnv } from '../config/env.js';

// Augment the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole; // Uses the Prisma Enum
        clinicTag?: string | null;
      };
    }
  }
}

/**
 * requireAuth (formerly authenticateToken)
 * Validates the JWT and attaches the user to the request.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const env = getEnv();
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    
    // Normalize payload to match our Request interface
    req.user = {
      id: payload.sub || payload.id || payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      clinicTag: payload.clinicTag ?? null
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * requireRole
 * Guards routes based on the Prisma UserRole enum.
 */
export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Keep alias for backward compatibility if needed elsewhere
export const authenticateToken = requireAuth;