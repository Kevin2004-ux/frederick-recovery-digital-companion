// app/backend/src/controllers/authController.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto"; // <--- Needed for secure token generation
import { z } from "zod";
import { zxcvbn } from "zxcvbn-typescript";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js"; 
import * as userRepo from "../repositories/userRepo.js";
import { AuditService, AuditCategory, AuditStatus, AuditSeverity } from "../services/AuditService.js";
import { signAccessToken } from "../utils/jwt.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/mailer.js"; // <--- Import Mailers

/**
 * POST /auth/register
 */
export async function register(req: Request, res: Response): Promise<any> {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // 1. Password Strength Check
    if (password.length < 12) {
      return res.status(400).json({ code: "WEAK_PASSWORD", error: "Password must be at least 12 characters long." });
    }
    const strength = zxcvbn(password);
    if (strength.score < 3) {
      return res.status(400).json({ 
        code: "WEAK_PASSWORD", 
        error: "Password is too easy to guess.",
        suggestions: strength.feedback.suggestions 
      });
    }

   // ✅ Public signup is PATIENT-only.
   // OWNER and CLINIC accounts must be created via an admin/owner-only path.
    let userRole: UserRole = UserRole.PATIENT;

    if (role && role !== UserRole.PATIENT) {
      return res.status(400).json({ code: "ROLE_NOT_ALLOWED" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userRepo.createUser({
      email,
      passwordHash,
      role: userRole,
    });

    AuditService.log({
      req, category: AuditCategory.AUTH, type: "SIGNUP_SUCCESS",
      userId: user.id, role: user.role, status: AuditStatus.SUCCESS
    });

    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: user.role,
      requiresVerification: true
    });

  } catch (err: any) {
    console.error("Register Error:", err);
    if (err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "Email already in use" });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * POST /auth/login
 */
export async function login(req: Request, res: Response): Promise<any> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({ 
      where: { email },
      select: {
        id: true, email: true, passwordHash: true, role: true,
        tokenVersion: true, isBanned: true, lockedUntil: true, failedLoginAttempts: true,
        emailVerifiedAt: true // <--- NEW: Select this field to check verification status
      }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isBanned) {
      AuditService.log({
        req, category: AuditCategory.AUTH, type: "BANNED_LOGIN_ATTEMPT",
        userId: user.id, status: AuditStatus.FORBIDDEN, severity: AuditSeverity.WARN
      });
      return res.status(403).json({ code: "ACCOUNT_TERMINATED", message: "Account is permanently disabled." });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      AuditService.log({
        req, category: AuditCategory.AUTH, type: "LOCKED_LOGIN_ATTEMPT",
        userId: user.id, status: AuditStatus.FAILURE
      });
      return res.status(403).json({ code: "ACCOUNT_LOCKED", message: "Account locked. Try again later." });
    }

    const match = await bcrypt.compare(password, user.passwordHash);

    if (!match) {
      const newFailCount = user.failedLoginAttempts + 1;
      let updateData: any = { failedLoginAttempts: newFailCount };
      
      if (newFailCount >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); 
        AuditService.log({
          req, category: AuditCategory.AUTH, type: "ACCOUNT_LOCKED_OUT",
          userId: user.id, status: AuditStatus.FAILURE, severity: AuditSeverity.WARN
        });
      }

      await prisma.user.update({ where: { id: user.id }, data: updateData });

      AuditService.log({
        req, category: AuditCategory.AUTH, type: "LOGIN_FAILED",
        status: AuditStatus.FAILURE, metadata: { email } 
      });
      
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // --- NEW: Enforce Patient Email Verification ---
    if (user.role === UserRole.PATIENT && !user.emailVerifiedAt) {
      return res.status(403).json({ code: "EMAIL_NOT_VERIFIED", message: "Please verify your email before logging in." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }
    });

    const token = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion 
    });

    AuditService.log({
      req, category: AuditCategory.AUTH, type: "LOGIN_SUCCESS",
      userId: user.id, role: user.role, status: AuditStatus.SUCCESS
    });

    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

/**
 * POST /auth/verify
 */
export async function verify(req: Request, res: Response): Promise<any> {
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
    await userRepo.verifyEmailCode(email, code);

    const user = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true, email: true, role: true, tokenVersion: true }
    });
    
    if (!user) return res.status(404).json({ code: "USER_NOT_FOUND" });

    // Note: The spec says do NOT issue a token upon verify so they are forced to use the login page.
    // However, if you want the UX to be smooth, you can issue it here. For strict compliance, 
    // we return success and force them to /SignIn.
    
    AuditService.log({
      req, category: AuditCategory.AUTH, type: "VERIFY_SUCCESS",
      userId: user.id, role: user.role, status: AuditStatus.SUCCESS
    });

    return res.status(200).json({ success: true, message: "Email verified successfully." });

  } catch (e: any) {
    if (e.message === "INVALID_CODE" || e.message === "CODE_EXPIRED" || e.message === "NO_CODE") {
      AuditService.log({
        req, category: AuditCategory.AUTH, type: "VERIFY_FAILED",
        status: AuditStatus.FAILURE, metadata: { reason: e.message, email }
      });
      return res.status(400).json({ code: e.message });
    }
    console.error("Verify Error:", e);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

/**
 * POST /auth/verify/resend (NEW)
 * Generates a new code and triggers the mailer (which prints to console for now)
 */
export async function resendVerification(req: Request, res: Response): Promise<any> {
  const email = req.body.email;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Email required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return success to prevent email enumeration
      return res.status(200).json({ ok: true, message: "If account exists, code sent." });
    }

    if (user.emailVerifiedAt) {
      return res.status(400).json({ code: "ALREADY_VERIFIED", message: "Account is already verified." });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationExpiresAt: expiresAt }
    });

    await sendVerificationEmail({
      to: user.email,
      code: verificationCode,
      expiresMinutes: 15
    });

    return res.status(200).json({ ok: true, message: "Verification code resent." });
  } catch (err) {
    console.error("Resend Verification Error:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

/**
 * POST /auth/forgot-password
 * Initializes password reset flow.
 */
export async function forgotPassword(req: Request, res: Response): Promise<any> {
  const email = req.body.email;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Email required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // SECURITY: Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({ ok: true, message: "If account exists, email sent." });
    }

    // 1. Generate Token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    // 2. Save Hash + Expiry (1 hour)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }
    });

    // 3. Send Email (with PLAIN token)
    await sendPasswordResetEmail({ to: user.email, token: resetToken });

    AuditService.log({
      req, category: AuditCategory.AUTH, type: "PASSWORD_RESET_REQUESTED",
      userId: user.id, role: user.role, status: AuditStatus.SUCCESS
    });

    return res.status(200).json({ ok: true, message: "If account exists, email sent." });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

/**
 * POST /auth/reset-password
 * Completes the reset.
 */
export async function resetPassword(req: Request, res: Response): Promise<any> {
  const Schema = z.object({
    token: z.string(),
    password: z.string().min(12, "Password must be 12+ characters")
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { token, password } = parsed.data;

  try {
    // 1. Hash the incoming token to match DB
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Find User with valid, non-expired token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() }
      }
    });

    if (!user) {
      // Generic error to avoid revealing why (invalid vs expired)
      return res.status(400).json({ code: "INVALID_RESET_TOKEN", message: "Token is invalid or expired." });
    }

    // 3. Password Strength Check
    const strength = zxcvbn(password);
    if (strength.score < 3) {
      return res.status(400).json({ code: "WEAK_PASSWORD", error: "Password is too weak." });
    }

    // 4. Update Password & Security Fields
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }, // <--- INVALIDATES ALL OLD SESSIONS
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        lockedUntil: null, // Optional: unlock account if they successfully reset
        failedLoginAttempts: 0
      }
    });

    AuditService.log({
      req, category: AuditCategory.AUTH, type: "PASSWORD_RESET_SUCCESS",
      userId: user.id, role: user.role, status: AuditStatus.SUCCESS
    });

    return res.status(200).json({ ok: true, message: "Password updated successfully." });

  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
}

/**
 * GET /auth/me
 */
export async function getProfile(req: Request, res: Response): Promise<any> {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const profile = await userRepo.getUserProfile(userId);
    return res.json(profile);
  } catch (err: any) {
    console.error("GetProfile Error:", err);
    if (err.message === "USER_NOT_FOUND") {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
} // <--- THIS BRACE WAS MISSING!

/**
 * POST /auth/consent/accept
 */
export async function acceptConsent(req: Request, res: Response): Promise<any> {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await userRepo.acceptConsent(userId);

    AuditService.log({
      req, category: AuditCategory.AUTH, type: "CONSENT_ACCEPTED",
      userId, role: req.user?.role, status: AuditStatus.SUCCESS
    });

    return res.json({ success: true, message: "Consent accepted" });
  } catch (err) {
    console.error("Accept Consent Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}