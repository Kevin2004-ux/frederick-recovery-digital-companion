// app/backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

// Force a shared secret for local dev to prevent "Split Brain" issues
const getSecret = () => {
  const env = getEnv();
  const secret = env.JWT_SECRET || "dev-secret-change-me-12345";
  return secret;
};

export function signAccessToken(params: { sub: string; email: string; role: string }) {
  const secret = getSecret();
  // We log this once to the server console to verify it's active
  console.log(`[JWT] Signing token for ${params.email} using secret: ${secret.substring(0, 5)}...`);
  
  return jwt.sign({ sub: params.sub, email: params.email, role: params.role }, secret, {
    expiresIn: "7d",
  });
}

export function verifyAccessToken(token: string): { sub: string; email: string; role: string } {
  const secret = getSecret();
  try {
    const payload = jwt.verify(token, secret) as any;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch (err: any) {
    // THIS LOG IS CRITICAL: Check your server terminal (pnpm dev) for this output
    console.error(`[JWT] Verify Error: ${err.message} | Secret used: ${secret.substring(0, 5)}...`);
    throw err;
  }
}