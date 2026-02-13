// app/backend/src/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { AuditService, AuditCategory, AuditStatus } from "../services/AuditService.js";

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role as UserRole;

    if (!userRole || !allowedRoles.includes(userRole)) {
      // SECURITY EVENT: Role violation attempt
      AuditService.log({
        req,
        category: AuditCategory.ACCESS,
        type: "UNAUTHORIZED_ROLE_ATTEMPT",
        userId: req.user?.id,
        role: userRole || "GUEST",
        status: AuditStatus.FORBIDDEN,
        metadata: { requiredRoles: allowedRoles, path: req.originalUrl }
      });
      
      return res.status(403).json({ code: "FORBIDDEN" });
    }

    next();
  };
}