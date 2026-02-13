import { verifyAccessToken } from "../utils/jwt.js";
import { prisma } from "../db/prisma.js";
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
    }
    try {
        const payload = verifyAccessToken(token);
        // Optional: Check DB to ensure user wasn't banned/deleted since token issue
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, clinicTag: true }
        });
        if (!user) {
            return res.status(401).json({ code: "UNAUTHORIZED" });
        }
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role, // <--- Now matches strict UserRole type
            clinicTag: user.clinicTag
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
    }
}
