import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
/**
 * requireAuth (formerly authenticateToken)
 * Validates the JWT and attaches the user to the request.
 */
export const requireAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const env = getEnv();
        const payload = jwt.verify(token, env.JWT_SECRET);
        // Normalize payload to match our Request interface
        req.user = {
            id: payload.sub || payload.id || payload.userId,
            email: payload.email,
            role: payload.role,
            clinicTag: payload.clinicTag ?? null
        };
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};
/**
 * requireRole
 * Guards routes based on the Prisma UserRole enum.
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
// Keep alias for backward compatibility if needed elsewhere
export const authenticateToken = requireAuth;
