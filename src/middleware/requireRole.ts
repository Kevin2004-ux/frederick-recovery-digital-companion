// app/backend/src/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { AuditService, AuditCategory, AuditStatus } from "../services/AuditService.js";

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // FIX: Use 'type', 'category', and 'status' instead of just 'action'
      AuditService.log({
        req,
        category: AuditCategory.ACCESS,
        type: "UNAUTHORIZED_ROLE_ATTEMPT",
        userId: req.user.id,
        role: req.user.role,
        status: AuditStatus.FORBIDDEN,
        metadata: {
          required: allowedRoles,
          actual: req.user.role
        }
      });
      
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}