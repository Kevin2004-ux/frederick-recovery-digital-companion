import type { AuthUser } from "@/types/auth";
import type { RecoveryLogEntry } from "@/types/log";

export class ApiError extends Error {
  status: number;
  data: unknown;
  code?: string;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    if (typeof data === "object" && data !== null && "code" in data) {
      this.code = String((data as { code?: string }).code);
    }
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || "https://frederick-backend.onrender.com";
const TOKEN_KEYS = ["frederick_api_token", "frdc_token"] as const;
const USER_KEY = "frederick_auth_user";
const SESSION_START_KEY = "frederick_session_started_at";
const LAST_ACTIVITY_KEY = "frederick_last_activity_at";
const TRACKER_DRAFT_PREFIX = "frdc_draft_";

const unauthorizedListeners = new Set<() => void>();

function parseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function formatIssue(issue: unknown) {
  if (!issue || typeof issue !== "object") {
    return null;
  }

  const issueRecord = issue as { path?: unknown; message?: unknown };
  const path = Array.isArray(issueRecord.path)
    ? issueRecord.path.filter((segment): segment is string | number => typeof segment === "string" || typeof segment === "number").join(".")
    : typeof issueRecord.path === "string"
      ? issueRecord.path
      : "";
  const message = typeof issueRecord.message === "string" ? issueRecord.message : "";

  if (!path && !message) {
    return null;
  }

  return path ? `${path}: ${message}` : message;
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as {
    message?: unknown;
    error?: unknown;
    code?: unknown;
    issues?: unknown;
  };

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  if (Array.isArray(record.issues) && record.issues.length > 0) {
    const formatted = record.issues
      .map(formatIssue)
      .filter((issue): issue is string => Boolean(issue));

    if (formatted.length > 0) {
      return formatted.slice(0, 2).join(" • ");
    }
  }

  if (typeof record.code === "string" && record.code.trim()) {
    return record.code.trim().replaceAll("_", " ").toLowerCase();
  }

  return fallback;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text || null;
}

function sanitizeStoredUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  } satisfies Pick<AuthUser, "id" | "email" | "role">;
}

export function getStoredToken() {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) {
      return token;
    }
  }

  return null;
}

export function setStoredToken(token: string | null) {
  for (const key of TOKEN_KEYS) {
    if (token) {
      localStorage.setItem(key, token);
    } else {
      localStorage.removeItem(key);
    }
  }
}

export function getStoredUser() {
  return parseJson<AuthUser>(localStorage.getItem(USER_KEY));
}

export function setStoredUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(sanitizeStoredUser(user)));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function clearTrackerDraftStorage() {
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(TRACKER_DRAFT_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export function getStoredSessionStart() {
  return Number(localStorage.getItem(SESSION_START_KEY) || "0") || 0;
}

export function getStoredLastActivity() {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || "0") || 0;
}

export function updateSessionTimes(options?: { start?: boolean }) {
  const now = Date.now();
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  if (options?.start) {
    localStorage.setItem(SESSION_START_KEY, String(now));
  }
}

export function clearAuthStorage() {
  setStoredToken(null);
  setStoredUser(null);
  localStorage.removeItem(SESSION_START_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
  clearTrackerDraftStorage();
}

function notifyUnauthorized() {
  clearAuthStorage();
  for (const listener of unauthorizedListeners) {
    listener();
  }
}

export function registerUnauthorizedListener(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

async function request<T>(path: string, options: RequestInit = {}, expect: "json" | "blob" = "json") {
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    notifyUnauthorized();
  }

  if (!response.ok) {
    const data = await parseResponseBody(response);
    throw new ApiError(
      response.status,
      extractErrorMessage(data, response.statusText || "Request failed"),
      data,
    );
  }

  if (expect === "blob") {
    return (await response.blob()) as T;
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export const api = {
  get<T>(path: string) {
    return request<T>(path, { method: "GET" });
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  async downloadBlob(path: string, filename: string) {
    const blob = await request<Blob>(path, { method: "GET" }, "blob");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};

export function saveTrackerDraft(date: string, entry: RecoveryLogEntry) {
  localStorage.setItem(`${TRACKER_DRAFT_PREFIX}${date}`, JSON.stringify(entry));
}

export function loadTrackerDraft(date: string) {
  return parseJson<RecoveryLogEntry>(localStorage.getItem(`${TRACKER_DRAFT_PREFIX}${date}`));
}

export function clearTrackerDraft(date: string) {
  localStorage.removeItem(`${TRACKER_DRAFT_PREFIX}${date}`);
}
