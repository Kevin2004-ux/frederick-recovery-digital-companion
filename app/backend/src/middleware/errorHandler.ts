// app/backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

const SENSITIVE_ERROR_MESSAGE_PATTERNS = [
  /authorization/i,
  /bearer/i,
  /cookie/i,
  /secret/i,
  /token/i,
  /password/i,
  /symptom/i,
  /medication/i,
  /red flag/i,
  /patient/i,
  /note/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function isProductionLikeEnvironment() {
  return process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
}

function getSafeErrorMessage(err: unknown): string {
  if (err instanceof ZodError) {
    return "Validation failed";
  }

  if (err && typeof err === "object" && "code" in err) {
    const code = typeof err.code === "string" ? err.code : "";
    if (code === "P2002") return "Unique constraint violation";
    if (code === "P2025") return "Record not found";
  }

  const message = err instanceof Error ? err.message : undefined;
  if (!message) {
    return "Unexpected error";
  }

  if (SENSITIVE_ERROR_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return "Sensitive error message redacted";
  }

  return message;
}

function sanitizeErrorForLog(err: unknown, req: Request) {
  const isObject = err !== null && typeof err === "object";
  const statusCode =
    isObject && "statusCode" in err && typeof err.statusCode === "number"
      ? err.statusCode
      : isObject && "status" in err && typeof err.status === "number"
        ? err.status
        : undefined;

  const sanitized = {
    method: req.method,
    path: req.path,
    name: err instanceof Error ? err.name : undefined,
    code: isObject && "code" in err && typeof err.code === "string" ? err.code : undefined,
    message: getSafeErrorMessage(err),
    statusCode,
  };

  if (!isProductionLikeEnvironment() && err instanceof Error && err.stack) {
    return {
      ...sanitized,
      stack: err.stack,
    };
  }

  return sanitized;
}

/**
 * Centralized Error Handler
 * Catches all errors thrown in routes/controllers
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // 1. Log the error for debugging (exclude 404s/401s if you want cleaner logs)
  console.error("[ERROR]", sanitizeErrorForLog(err, req));

  // 2. Handle Zod Validation Errors (Input Validation)
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      issues: err.errors, // returns detailed field-level issues
    });
  }

  // 3. Handle Known App Logic Errors
  // These matches the strings thrown in userRepo.ts
  if (err.message === "EMAIL_TAKEN") {
    return res.status(409).json({ code: "EMAIL_ALREADY_EXISTS" });
  }
  if (err.message === "USER_NOT_FOUND") {
    return res.status(404).json({ code: "USER_NOT_FOUND" });
  }
  if (err.message === "INVALID_CREDENTIALS") {
    return res.status(401).json({ code: "INVALID_CREDENTIALS" });
  }
  if (err.message === "NO_PLAN_TEMPLATE") {
    return res.status(500).json({ code: "NO_PLAN_TEMPLATE", message: "Configuration Error: No template found." });
  }
  
  // 4. Handle JWT Errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ code: "INVALID_TOKEN" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ code: "TOKEN_EXPIRED" });
  }

  // 5. Handle Prisma Database Errors
  // P2002 = Unique constraint failed
  if (err.code === "P2002") {
    return res.status(409).json({ code: "CONFLICT", message: "Unique constraint violation" });
  }
  // P2025 = Record not found (when using findUniqueOrThrow)
  if (err.code === "P2025") {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  // 6. Fallback: Internal Server Error
  // Don't leak stack traces to the client in production
  res.status(500).json({ 
    code: "INTERNAL_SERVER_ERROR", 
    message: "Something went wrong." 
  });
}
