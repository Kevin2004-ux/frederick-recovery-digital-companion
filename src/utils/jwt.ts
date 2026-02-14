// app/backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

// Retrieve the secret from our validated environment config.
const getSecret = () => {
  const env = getEnv();
  if (!env.JWT_SECRET) {
    throw new Error("[CRITICAL] JWT_SECRET is missing from environment variables.");
  }
  return env.JWT_SECRET;
};

// Updated signature: Now requires 'tokenVersion'
export function signAccessToken(params: { sub: string; email: string; role: string; tokenVersion: number }) {
  const secret = getSecret();
  // Safe debug log
  console.log(`[JWT] Signing token for ${params.email} (v${params.tokenVersion})`);

  return jwt.sign({
    sub: params.sub,
    email: params.email,
    role: params.role,
    tokenVersion: params.tokenVersion // <--- Critical Security Addition
  }, secret, {
    expiresIn: "7d", // Short-lived access token
    algorithm: "HS256"
  });
}

export function verifyAccessToken(token: string) {
  const secret = getSecret();
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
    // Normalize and return all claims including version
    return {
      sub: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion // <--- Now available to middleware
    };
  } catch (err: any) {
    console.error(`[JWT] Verify Error: ${err.message}`);
    throw err;
  }
}