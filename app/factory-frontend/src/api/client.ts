import { getStoredToken } from "@/lib/session";

const DEFAULT_API_URL = "https://frederick-backend.onrender.com";

export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: unknown;

  constructor(message: string, status: number, code?: string, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

function getBaseUrl() {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

function buildHeaders(body: unknown, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const token = getStoredToken();

  if (body !== undefined && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

function extractMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const maybeMessage =
      ("message" in payload && typeof payload.message === "string" && payload.message) ||
      ("error" in payload && typeof payload.error === "string" && payload.error);

    if (maybeMessage) {
      return maybeMessage;
    }
  }

  return fallback;
}

function extractCode(payload: unknown) {
  if (payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string") {
    return payload.code;
  }

  return undefined;
}

function extractIssues(payload: unknown) {
  if (payload && typeof payload === "object" && "issues" in payload) {
    return payload.issues;
  }

  return undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.body, options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const rawText = await response.text();
  const payload = rawText ? (() => {
    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  })() : null;

  if (!response.ok) {
    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      extractCode(payload),
      extractIssues(payload),
    );
  }

  return payload as T;
}

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: buildHeaders(options.body, options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const rawText = await response.text();
    const payload = rawText
      ? (() => {
          try {
            return JSON.parse(rawText);
          } catch {
            return rawText;
          }
        })()
      : null;

    throw new ApiError(
      extractMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      extractCode(payload),
      extractIssues(payload),
    );
  }

  return response.blob();
}

export const api = {
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body,
    });
  },
  delete<T>(path: string) {
    return request<T>(path, {
      method: "DELETE",
    });
  },
  blob(path: string, options: RequestOptions = {}) {
    return requestBlob(path, options);
  },
};
