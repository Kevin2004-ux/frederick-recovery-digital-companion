import { clearToken, getToken } from "@/auth/token";

type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

type ApiOptions = {
  method?: string;
  json?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

type ErrorPayload = {
  code?: string;
  message?: string;
  issues?: unknown;
};

const BASE_URL =
  import.meta.env.VITE_API_URL || "https://frederick-backend.onrender.com";

let navigateRef: NavigateFn | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;
  issues?: unknown;

  constructor(
    message: string,
    options: { status: number; code?: string; issues?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.issues = options.issues;
  }
}

export function setApiNavigator(navigate: NavigateFn | null): void {
  navigateRef = navigate;
}

function redirectForError(status: number, code?: string) {
  if (!navigateRef) return;

  if (status === 401 || code === "UNAUTHORIZED") {
    clearToken();
    navigateRef("/login", { replace: true });
    return;
  }

  if (status === 403 && code === "CONSENT_REQUIRED") {
    navigateRef("/consent", { replace: true });
    return;
  }

  if (status === 403 && code === "ONBOARDING_REQUIRED") {
    navigateRef("/onboarding", { replace: true });
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  return text ? text : undefined;
}

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const payload = body as ErrorPayload;
    return new ApiError(
      payload.message || payload.code || "Request failed.",
      { status, code: payload.code, issues: payload.issues }
    );
  }

  if (typeof body === "string" && body.trim()) {
    return new ApiError(body, { status });
  }

  return new ApiError("Request failed.", { status });
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();

  if (options.json !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: options.signal,
  });

  const body = await parseBody(res);

  if (!res.ok) {
    const err = toApiError(res.status, body);
    redirectForError(res.status, err.code);
    throw err;
  }

  return body as T;
}
