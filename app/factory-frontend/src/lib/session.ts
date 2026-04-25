import type { OwnerUser } from "@/types";

const TOKEN_KEY = "frederick_factory_token";
const USER_KEY = "frederick_factory_user";

export function getStoredToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): OwnerUser | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OwnerUser>;
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.email === "string" &&
      parsed.role === "OWNER"
    ) {
      return parsed as OwnerUser;
    }
  } catch {
    clearSession();
  }

  return null;
}

export function setSession(token: string, user: OwnerUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user: OwnerUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isOwnerUser(
  user: { id?: string; email?: string; role?: string } | null | undefined,
): user is OwnerUser {
  return Boolean(
    user &&
      typeof user === "object" &&
      typeof user.email === "string" &&
      typeof user.id === "string" &&
      user.role === "OWNER",
  );
}
