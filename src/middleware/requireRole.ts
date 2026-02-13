// app/backend/src/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { AuditService, AuditCategory, AuditStatus, AuditSeverity } from "../services/AuditService.js";

export function requireRole(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      
      // ✅ SECURITY FIX: Await the log write.
      // We block the response until we are sure we recorded this violation.
      await AuditService.log({
        req,
        category: AuditCategory.ACCESS,
        action: "UNAUTHORIZED_ROLE_ATTEMPT", // specific action name
        userId: req.user?.id,
        status: AuditStatus.FORBIDDEN,
        severity: AuditSeverity.WARN,
        details: { 
          requiredRoles: allowedRoles, 
          path: req.originalUrl 
        }
      });
      
      return res.status(403).json({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }

    next();
  };
}