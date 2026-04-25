import assert from "node:assert/strict";

import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { errorHandler } from "../src/middleware/errorHandler.js";

const originalEnv = { ...process.env };
const originalConsoleError = console.error;

function createResponseDouble() {
  const state: { statusCode?: number; body?: unknown } = {};

  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
  } as Response;

  return { res, state };
}

function createRequestDouble(): Request {
  return {
    method: "POST",
    path: "/api/logs",
    body: {
      notes: "private patient notes",
      medications: ["secret medication"],
      token: "very-secret-token",
    },
    params: { id: "patient-123" },
    query: { email: "patient@example.com" },
    headers: { authorization: "Bearer very-secret-token", cookie: "session=secret" },
  } as unknown as Request;
}

function restoreGlobals() {
  process.env = { ...originalEnv };
  console.error = originalConsoleError;
}

function run() {
  try {
    process.env = { ...originalEnv, APP_ENV: "production", NODE_ENV: "production" };

    const loggedEntries: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      loggedEntries.push(args);
    };

    const req = createRequestDouble();
    const { res, state } = createResponseDouble();

    errorHandler(new Error("Token invalid for patient@example.com"), req, res, (() => undefined) as NextFunction);

    assert.equal(state.statusCode, 500);
    assert.deepEqual(state.body, {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong.",
    });

    assert.equal(loggedEntries.length, 1);
    assert.equal(loggedEntries[0][0], "[ERROR]");

    const loggedSummary = loggedEntries[0][1] as Record<string, unknown>;
    assert.deepEqual(loggedSummary, {
      method: "POST",
      path: "/api/logs",
      name: "Error",
      code: undefined,
      message: "Sensitive error message redacted",
      statusCode: undefined,
    });
    assert.ok(!("body" in loggedSummary));
    assert.ok(!("params" in loggedSummary));
    assert.ok(!("query" in loggedSummary));
    assert.ok(!("headers" in loggedSummary));
    assert.ok(!("stack" in loggedSummary));

    loggedEntries.length = 0;
    const zodRes = createResponseDouble();
    const zodError = new ZodError([
      {
        code: "too_small",
        minimum: 1,
        inclusive: true,
        path: ["notes"],
        message: "String must contain at least 1 character(s)",
        type: "string",
      },
    ]);

    errorHandler(zodError, req, zodRes.res, (() => undefined) as NextFunction);

    assert.equal(zodRes.state.statusCode, 400);
    assert.deepEqual(zodRes.state.body, {
      code: "VALIDATION_ERROR",
      issues: zodError.errors,
    });
    assert.equal((loggedEntries[0][1] as Record<string, unknown>).message, "Validation failed");

    loggedEntries.length = 0;
    const prismaRes = createResponseDouble();
    const prismaError = {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      meta: {
        target: ["email"],
        submitted: "patient@example.com",
      },
      message: "Unique constraint failed on the fields: (`email`)",
      statusCode: 409,
    };

    errorHandler(prismaError, req, prismaRes.res, (() => undefined) as NextFunction);

    assert.equal(prismaRes.state.statusCode, 409);
    assert.deepEqual(prismaRes.state.body, {
      code: "CONFLICT",
      message: "Unique constraint violation",
    });
    assert.deepEqual(loggedEntries[0][1], {
      method: "POST",
      path: "/api/logs",
      name: undefined,
      code: "P2002",
      message: "Unique constraint violation",
      statusCode: 409,
    });

    console.log("Error handler log sanitization checks passed.");
  } finally {
    restoreGlobals();
  }
}

run();
