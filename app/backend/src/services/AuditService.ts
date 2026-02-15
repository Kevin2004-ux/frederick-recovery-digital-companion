// app/backend/src/services/AuditService.ts
import { prisma } from "../db/prisma.js";
import { Request } from "express";

export enum AuditCategory {
  AUTH = "auth",
  ACCESS = "access",
  PLAN = "plan",
  LOG = "log",
  ADMIN = "admin",
}

export enum AuditStatus {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
  FORBIDDEN = "FORBIDDEN",
}

export enum AuditSeverity {
  INFO = "INFO",
  WARN = "WARN",
  CRITICAL = "CRITICAL",
}

interface AuditLogParams {
  req?: Request;
  category: AuditCategory;
  type: string; // Event type (e.g., "LOGIN_FAILED")
  status: AuditStatus;
  userId?: string;
  role?: string;
  clinicTag?: string | null;
  patientUserId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
}

// Helper to remove sensitive keys from metadata before logging
function redactMetadata(meta: Record<string, any>): Record<string, any> {
  if (!meta) return {};
  const sensitiveKeys = ["password", "token", "code", "secret", "authorization"];
  const clean = { ...meta };
  
  for (const key of Object.keys(clean)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      clean[key] = "[REDACTED]";
    }
  }
  return clean;
}

export const AuditService = {
  /**
   * Logs security events to the database.
   * Returns a Promise so critical events can be awaited (fail-closed).
   */
  async log(params: AuditLogParams) {
    const { req, metadata, ...data } = params;

    // scrub sensitive data
    const safeMetadata = metadata ? redactMetadata(metadata) : {};

    try {
      await prisma.securityAudit.create({
        data: {
          actorUserId: data.userId,
          actorRole: data.role || "GUEST",
          eventCategory: data.category,
          eventType: data.type,
          clinicTag: data.clinicTag,
          patientUserId: data.patientUserId,
          targetObjectId: data.targetId,
          targetObjectType: data.targetType,
          ipAddress: req?.ip || req?.headers['x-forwarded-for']?.toString() || "unknown",
          userAgent: req?.headers["user-agent"] || "unknown",
          status: data.status,
          metadata: safeMetadata,
        },
      });
    } catch (err) {
      // If the DB audit fails, we MUST log to the server console as a fallback.
      // In a high-security environment, we might throw here to stop the request.
      console.error("[CRITICAL] AuditService failed to write to DB:", err);
      
      // If this was a CRITICAL severity event, re-throw to block the action
      if (params.severity === AuditSeverity.CRITICAL) {
        throw new Error("Audit Failure: Critical action blocked due to logging error.");
      }
    }
  },
};