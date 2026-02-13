// app/backend/src/services/AuditService.ts
import { prisma } from "../db/prisma.js";

export enum AuditCategory {
  AUTH = "auth",
  ACCESS = "access",
  PLAN = "plan",
  LOG = "log",
  ADMIN = "admin"
}

export enum AuditStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  FORBIDDEN = "FORBIDDEN"
}

interface AuditParams {
  req: any;          // Express Request to extract IP and User-Agent
  category: AuditCategory;
  type: string;      // e.g., "LOGIN_SUCCESS", "UNAUTHORIZED_ACCESS_ATTEMPT"
  userId?: string;
  role?: string;
  clinicTag?: string | null;
  patientUserId?: string;
  targetId?: string;
  targetType?: string;
  status: AuditStatus;
  metadata?: any;    // Redacted context (No PHI here!)
}

export const AuditService = {
  /**
   * Logs security events to the database.
   * This is fire-and-forget (not awaited) to maintain API performance.
   */
  log(params: AuditParams) {
    const { req, ...data } = params;

    prisma.securityAudit.create({
      data: {
        actorUserId: data.userId,
        actorRole: data.role || "GUEST",
        eventCategory: data.category,
        eventType: data.type,
        clinicTag: data.clinicTag,
        patientUserId: data.patientUserId,
        targetObjectId: data.targetId,
        targetObjectType: data.targetType,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        status: data.status,
        metadata: data.metadata || {},
      }
    }).catch(err => {
      // If audit logging fails, we must at least log it to the server console
      console.error("[CRITICAL] AuditService failed to write to DB:", err);
    });
  }
};