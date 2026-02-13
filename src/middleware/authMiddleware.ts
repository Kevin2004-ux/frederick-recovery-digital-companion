import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(1),
});

const env = envSchema.parse(process.env);

// Define the User Role type
export type UserRole = 'PATIENT' | 'CLINIC_ADMIN' | 'SURGEON';

// Augment the Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        clinicTag?: string | null;
      };
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, env.JWT_SECRET) as any;
    
    // Normalize the user object to match strict TS expectations
    // If the token has 'userId', we map it to 'id'
    req.user = {
      id: user.id || user.userId,
      email: user.email,
      role: user.role as UserRole,
      clinicTag: user.clinicTag
    };
    
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};