// app/backend/src/utils/jwt.ts
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

type SignedTokenPayload = {
  sub?: string;
  id?: string;
  email?: string;
  role?: string;
  tokenVersion?: number;
  purpose?: string;
};

// Retrieve the secret from our validated environment config.
const getSecret = () => {
  const env = getEnv();
  if (!env.JWT_SECRET) {
    throw new Error("[CRITICAL] JWT_SECRET is missing from environment variables.");
  }
  return env.JWT_SECRET;
};

function verifySignedToken(token: string) {
  const secret = getSecret();
  return jwt.verify(token, secret, { algorithms: ["HS256"] }) as SignedTokenPayload;
}

function normalizeCorePayload(payload: SignedTokenPayload) {
  const sub = payload.sub || payload.id;

  if (
    !sub ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.tokenVersion !== "number"
  ) {
    throw new Error("INVALID_TOKEN_PAYLOAD");
  }

  return {
    sub,
    email: payload.email,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
    purpose: payload.purpose,
  };
}

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

export function signMfaLoginToken(params: {
  sub: string;
  email: string;
  role: string;
  tokenVersion: number;
}) {
  const secret = getSecret();

  return jwt.sign(
    {
      sub: params.sub,
      email: params.email,
      role: params.role,
      tokenVersion: params.tokenVersion,
      purpose: "mfa_login",
    },
    secret,
    {
      expiresIn: "5m",
      algorithm: "HS256",
    }
  );
}

export function verifyAccessToken(token: string) {
  try {
    const payload = normalizeCorePayload(verifySignedToken(token));
    if (payload.purpose && payload.purpose !== "access") {
      throw new Error("INVALID_ACCESS_TOKEN_PURPOSE");
    }

    // Normalize and return all claims including version
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion // <--- Now available to middleware
    };
  } catch (err: any) {
    console.error(`[JWT] Verify Error: ${err.message}`);
    throw err;
  }
}

export function verifyMfaLoginToken(token: string) {
  try {
    const payload = normalizeCorePayload(verifySignedToken(token));
    if (payload.purpose !== "mfa_login") {
      throw new Error("INVALID_MFA_TOKEN_PURPOSE");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion,
      purpose: payload.purpose,
    };
  } catch (err: any) {
    console.error(`[JWT] MFA Verify Error: ${err.message}`);
    throw err;
  }
}
