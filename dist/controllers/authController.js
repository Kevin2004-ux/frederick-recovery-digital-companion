import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import * as userRepo from "../repositories/userRepo.js";
import { AuditService, AuditCategory, AuditStatus } from "../services/AuditService.js";
import { signAccessToken } from "../utils/jwt.js"; // <--- IMPORT THIS
/**
 * POST /auth/register
 * Body: { email, password, role? }
 */
export async function register(req, res) {
    try {
        const { email, password, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters" });
        }
        // validate role if provided
        let userRole = undefined;
        if (role) {
            if (!Object.values(UserRole).includes(role)) {
                return res.status(400).json({ error: "Invalid role specified" });
            }
            userRole = role;
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await userRepo.createUser({
            email,
            passwordHash,
            role: userRole,
        });
        AuditService.log({
            req,
            category: AuditCategory.AUTH,
            type: "SIGNUP_SUCCESS",
            userId: user.id,
            role: user.role,
            status: AuditStatus.SUCCESS
        });
        res.status(201).json({
            id: user.id,
            email: user.email,
            role: user.role,
            requiresVerification: true
        });
    }
    catch (err) {
        console.error("Register Error:", err);
        if (err.message === "EMAIL_TAKEN") {
            return res.status(409).json({ error: "Email already in use" });
        }
        // Pass to global error handler in a real scenario, but for now return 500
        res.status(500).json({ error: "Internal Server Error" });
    }
}
/**
 * POST /auth/login
 * Body: { email, password }
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }
        const user = await userRepo.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            AuditService.log({
                req,
                category: AuditCategory.AUTH,
                type: "LOGIN_FAILED",
                status: AuditStatus.FAILURE,
                metadata: { email }
            });
            return res.status(401).json({ error: "Invalid credentials" });
        }
        // FIXED: Use centralized signer
        const token = signAccessToken({
            sub: user.id,
            email: user.email,
            role: user.role
        });
        AuditService.log({
            req,
            category: AuditCategory.AUTH,
            type: "LOGIN_SUCCESS",
            userId: user.id,
            role: user.role,
            status: AuditStatus.SUCCESS
        });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    }
    catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
/**
 * POST /auth/verify
 * Body: { email, code }
 */
export async function verify(req, res) {
    const VerifySchema = z.object({
        email: z.string().email(),
        code: z.string(),
    });
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
    }
    const { email, code } = parsed.data;
    try {
        // 1. Verify the code in the DB
        await userRepo.verifyEmailCode(email, code);
        // 2. Fetch the user to sign the token
        const user = await userRepo.findUserByEmail(email);
        if (!user)
            return res.status(404).json({ code: "USER_NOT_FOUND" });
        // 3. FIXED: Use centralized signer
        const token = signAccessToken({
            sub: user.id,
            email: user.email,
            role: user.role
        });
        // 4. Audit Log
        AuditService.log({
            req,
            category: AuditCategory.AUTH,
            type: "VERIFY_SUCCESS",
            userId: user.id,
            role: user.role,
            status: AuditStatus.SUCCESS
        });
        return res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role } });
    }
    catch (e) {
        if (e.message === "INVALID_CODE" || e.message === "CODE_EXPIRED" || e.message === "NO_CODE") {
            AuditService.log({
                req,
                category: AuditCategory.AUTH,
                type: "VERIFY_FAILED",
                status: AuditStatus.FAILURE,
                metadata: { reason: e.message, email }
            });
            return res.status(400).json({ code: e.message });
        }
        console.error("Verify Error:", e);
        return res.status(500).json({ code: "INTERNAL_ERROR" });
    }
}
/**
 * GET /auth/me
 * Requires Auth Middleware
 */
export async function getProfile(req, res) {
    try {
        const userId = req.user?.id; // <--- Changed from userId to id to match middleware payload
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const profile = await userRepo.getUserProfile(userId);
        res.json(profile);
    }
    catch (err) {
        console.error("GetProfile Error:", err);
        if (err.message === "USER_NOT_FOUND") {
            return res.status(404).json({ error: "User not found" });
        }
        res.status(500).json({ error: "Internal Server Error" });
    }
}
