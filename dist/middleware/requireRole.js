import { AuditService, AuditCategory, AuditStatus } from "../services/AuditService.js";
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user?.role;
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
