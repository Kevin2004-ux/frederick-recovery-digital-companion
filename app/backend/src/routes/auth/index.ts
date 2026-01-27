// app/backend/src/routes/auth/index.ts
import { Router } from "express";
import { z } from "zod";

import { acceptConsent, createUser, findUserByEmail, findUserById } from "../../repositories/userRepo.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { signAccessToken } from "../../utils/jwt.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";

export const authRouter = Router();

authRouter.get("/_debug", (_req, res) => {
  res.json({ ok: true, module: "auth" });
});

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

authRouter.post("/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);
    const user = createUser({ email, passwordHash });

    const token = signAccessToken({ sub: user.id, email: user.email });
    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (e: any) {
    if (e?.message === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "Email already in use" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signAccessToken({ sub: user.id, email: user.email });
  return res.json({
    token,
    user: { id: user.id, email: user.email },
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

authRouter.get("/consent", requireAuth, (req, res) => {
  const user = findUserById(req.user!.id);
  return res.json({
    accepted: Boolean(user?.consentAcceptedAt),
    acceptedAt: user?.consentAcceptedAt ?? null,
  });
});

authRouter.post("/consent", requireAuth, (req, res) => {
  const userId = req.user!.id;
  acceptConsent(userId);
  return res.status(204).send();
});
