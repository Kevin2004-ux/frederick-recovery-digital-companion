// app/backend/src/services/AuditService.ts
import { prisma } from "../db/prisma.js";
export var AuditCategory;
(function (AuditCategory) {
    AuditCategory["AUTH"] = "auth";
    AuditCategory["ACCESS"] = "access";
    AuditCategory["PLAN"] = "plan";
    AuditCategory["LOG"] = "log";
    AuditCategory["ADMIN"] = "admin";
})(AuditCategory || (AuditCategory = {}));
export var AuditStatus;
(function (AuditStatus) {
    AuditStatus["SUCCESS"] = "SUCCESS";
    AuditStatus["FAILURE"] = "FAILURE";
    AuditStatus["FORBIDDEN"] = "FORBIDDEN";
})(AuditStatus || (AuditStatus = {}));
export var AuditSeverity;
(function (AuditSeverity) {
    AuditSeverity["INFO"] = "INFO";
    AuditSeverity["WARN"] = "WARN";
    AuditSeverity["CRITICAL"] = "CRITICAL";
})(AuditSeverity || (AuditSeverity = {}));
// Helper to remove sensitive keys from metadata before logging
function redactMetadata(meta) {
    if (!meta)
        return {};
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
    async log(params) {
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
        }
        catch (err) {
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
