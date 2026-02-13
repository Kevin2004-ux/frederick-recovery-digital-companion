import { prisma } from "../prisma/client.js";
import { verifyAccessToken } from "../utils/jwt.js";
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ code: "UNAUTHORIZED" });
    }
    const token = header.slice("Bearer ".length).trim();
    try {
        const payload = verifyAccessToken(token);
        // Load authoritative role + clinicTag from DB (don’t trust token for role)
        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, role: true, clinicTag: true },
        });
        if (!user)
            return res.status(401).json({ code: "UNAUTHORIZED" });
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            clinicTag: user.clinicTag ?? null,
        };
        return next();
    }
    catch {
        return res.status(401).json({ code: "UNAUTHORIZED" });
    }
}
