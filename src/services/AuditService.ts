// app/backend/src/services/AuditService.ts
import { prisma } from "../db/prisma.js"; // Adjust path if your prisma export is in ../index.js
import { Request } from "express";

export enum AuditCategory {
  ACCESS = "ACCESS",
  CLINICAL = "CLINICAL",
  ADMIN = "ADMIN",
  SYSTEM = "SYSTEM"
}

export enum AuditStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  FORBIDDEN = "FORBIDDEN"
}

export enum AuditSeverity {
  INFO = "INFO",
  WARN = "WARN",
  CRITICAL = "CRITICAL"
}

interface AuditLogParams {
  req?: Request; // Optional: If provided, we extract IP/UserAgent automatically
  userId?: string;
  action: string; // e.g., "LOGIN_FAILED", "VIEWED_PLAN"
  category: AuditCategory;
  status: AuditStatus;
  severity?: AuditSeverity;
  details?: Record<string, any>;
}

export const AuditService = {
  /**
   * Log an event to the database.
   * MUST be awaited for critical actions (HIPAA requirement).
   */
  log: async (params: AuditLogParams) => {
    const { req, userId, action, category, status, severity, details } = params;

    // 1. Extract context from Request if available
    const ipAddress = req?.ip || req?.socket.remoteAddress || "unknown";
    const userAgent = req?.headers["user-agent"] || "unknown";
    
    // 2. Determine Actor (User)
    // If no userId passed, try to get it from req.user
    const actorId = userId || req?.user?.id;

    if (!actorId) {
      console.warn(`[Audit] Skipping log for ${action} - No User ID found.`);
      return;
    }

    try {
      // 3. Write to Database (The critical part)
      await prisma.auditLog.create({
        data: {
          userId: actorId,
          action: action,
          // Map our Enums to the DB Strings we added
          severity: severity || AuditSeverity.INFO,
          outcome: status,
          ipAddress: ipAddress,
          userAgent: userAgent,
          details: {
            category, // Store category inside JSON details if not a direct column
            ...details
          }
        }
      });
    } catch (error) {
      // 4. Fail-Safe Logging
      // If DB fails, we MUST log to console so standard output captures it.
      console.error(`[AUDIT FAILURE] Could not save audit log: ${action}`, error);
      // In a strict environment, you might throw here to stop the request entirely.
    }
  }
};