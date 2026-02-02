// app/backend/src/routes/auth/index.ts
import { Router } from "express";
import { z } from "zod";

import {
  acceptConsent,
  createUser,
  findUserByEmail,
  findUserById,
  setVerificationCode,
  verifyEmailCode,
} from "../../repositories/userRepo.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { signAccessToken } from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { sendVerificationEmail } from "../../utils/mailer.js";

export const authRouter = Router();

authRouter.get("/_debug", (_req, res) => {
  res.json({ ok: true, module: "auth" });
});

function make6DigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    await createUser({ email, passwordHash });

    const code = make6DigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await setVerificationCode(email, code, expiresAt);

    await sendVerificationEmail({
      to: email,
      code,
      expiresMinutes: 15,
    });

    // Do not issue token until verified.
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    if (e?.message === "EMAIL_TAKEN") {
      return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS" });
    }
    return res.status(500).json({ code: "UNKNOWN_ERROR" });
  }
});

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
});

authRouter.post("/verify", async (req, res) => {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { email, code } = parsed.data;

  try {
    await verifyEmailCode(email, code);
    return res.status(204).send();
  } catch (e: any) {
    const msg = e?.message;
    if (msg === "USER_NOT_FOUND") return res.status(404).json({ code: "USER_NOT_FOUND" });
    if (msg === "INVALID_CODE" || msg === "NO_CODE")
      return res.status(400).json({ code: "INVALID_CODE" });
    if (msg === "CODE_EXPIRED") return res.status(400).json({ code: "CODE_EXPIRED" });
    return res.status(500).json({ code: "UNKNOWN_ERROR" });
  }
});

const ResendSchema = z.object({
  email: z.string().email(),
});

authRouter.post("/verify/resend", async (req, res) => {
  const parsed = ResendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { email } = parsed.data;
  const user = await findUserByEmail(email);

  // MVP: return USER_NOT_FOUND (later we can make this always-ok to prevent enumeration)
  if (!user) return res.status(404).json({ code: "USER_NOT_FOUND" });

  // already verified? treat as success
  if (user.emailVerifiedAt) return res.status(204).send();

  const code = make6DigitCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await setVerificationCode(email, code, expiresAt);

  await sendVerificationEmail({
    to: email,
    code,
    expiresMinutes: 15,
  });

  return res.status(200).json({ ok: true });
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "VALIDATION_ERROR", issues: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ code: "INVALID_CREDENTIALS" });

  if (!user.emailVerifiedAt) {
    return res.status(403).json({ code: "EMAIL_NOT_VERIFIED" });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ code: "INVALID_CREDENTIALS" });

  const token = signAccessToken({ sub: user.id, email: user.email });
  return res.json({
    token,
    user: { id: user.id, email: user.email },
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

authRouter.get("/consent", requireAuth, async (req, res) => {
  const user = await findUserById(req.user!.id);
  return res.json({
    accepted: Boolean(user?.consentAcceptedAt),
    acceptedAt: user?.consentAcceptedAt ?? null,
  });
});

authRouter.post("/consent", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  await acceptConsent(userId);
  return res.status(204).send();
});
