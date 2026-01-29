import { clearToken, getToken } from "@/auth/token";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "CONSENT_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "ENTRY_ALREADY_EXISTS"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export type ApiError = {
  status: number;
  code: ApiErrorCode;
  message?: string;
  issues?: unknown[];
};

type NavigateFn = (to: string, opts?: { replace?: boolean }) => void;

let navigate: NavigateFn | null = null;

export function setApiNavigator(fn: NavigateFn) {
  navigate = fn;
}

function safeNavigate(to: string) {
  if (navigate) navigate(to, { replace: true });
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

/** Narrow unknown JSON into the shape we care about (without using `any`). */
function isErrorPayload(v: unknown): v is {
  code?: unknown;
  message?: unknown;
  issues?: unknown;
} {
  return typeof v === "object" && v !== null;
}

async function parseError(res: Response): Promise<ApiError> {
  let data: unknown = null;

  try {
    data = await res.json();
  } catch {
    // ignore – response body is not JSON
  }

  const payload = isErrorPayload(data) ? data : undefined;

  const codeFromBody =
    payload?.code && typeof payload.code === "string"
      ? (payload.code as ApiErrorCode)
      : undefined;

  const code: ApiErrorCode =
    codeFromBody ?? (res.status === 401 ? "UNAUTHORIZED" : "UNKNOWN_ERROR");

  const message =
    payload?.message && typeof payload.message === "string"
      ? payload.message
      : undefined;

  const issues = Array.isArray(payload?.issues) ? payload?.issues : undefined;

  return {
    status: res.status,
    code,
    message,
    issues,
  };
}

function handleGate(err: ApiError) {
  // CRITICAL routing behavior
  if (err.status === 401 && err.code === "UNAUTHORIZED") {
    clearToken();
    safeNavigate("/login");
    return;
  }
  if (err.status === 403 && err.code === "CONSENT_REQUIRED") {
    safeNavigate("/consent");
    return;
  }
  if (err.status === 403 && err.code === "ONBOARDING_REQUIRED") {
    safeNavigate("/onboarding");
    return;
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  // only set JSON headers when we are sending JSON
  const hasJson = typeof init.json !== "undefined";
  if (hasJson) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: hasJson ? JSON.stringify(init.json) : init.body,
  });

  if (!res.ok) {
    const err = await parseError(res);
    handleGate(err);
    throw err;
  }

  // 204 no content
  if (res.status === 204) return undefined as T;

  // Some endpoints return files; caller should use fetch directly for downloads.
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    // best-effort: return blob
    const blob = await res.blob();
    return blob as unknown as T;
  }

  return (await res.json()) as T;
}
 