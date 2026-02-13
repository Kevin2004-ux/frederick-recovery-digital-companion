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
export const AuditService = {
    /**
     * Logs security events to the database.
     * This is fire-and-forget (not awaited) to maintain API performance.
     */
    log(params) {
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
