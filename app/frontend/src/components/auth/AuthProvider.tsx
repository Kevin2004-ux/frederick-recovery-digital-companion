/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  api,
  clearAuthStorage,
  getStoredLastActivity,
  getStoredSessionStart,
  getStoredToken,
  getStoredUser,
  registerUnauthorizedListener,
  setStoredToken,
  setStoredUser,
  updateSessionTimes,
} from "@/api/client";
import { routes } from "@/lib/routes";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, fallbackUser?: Pick<AuthUser, "id" | "email" | "role">) => Promise<AuthUser>;
  logout: (redirectTo?: string) => void;
  refreshProfile: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => (getStoredToken() ? null : getStoredUser()));
  const [loading, setLoading] = useState(true);

  const logout = useCallback((redirectTo?: string) => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
    window.location.assign(redirectTo || routes.signIn);
  }, []);

  const refreshProfile = useCallback(async () => {
    const nextToken = getStoredToken();
    if (!nextToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const profile = await api.get<AuthUser>("/auth/me");
      setUser(profile);
      setStoredUser(profile);
      return profile;
    } catch (error) {
      const apiError = error as { status?: number; code?: string };
      if (
        apiError.status === 401 ||
        apiError.status === 403 ||
        apiError.status === 404 ||
        apiError.code === "UNAUTHORIZED" ||
        apiError.code === "TOKEN_REVOKED" ||
        apiError.code === "ACCOUNT_LOCKED" ||
        apiError.code === "ACCOUNT_TERMINATED"
      ) {
        clearAuthStorage();
        setToken(null);
        setUser(null);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (nextToken: string, fallbackUser?: Pick<AuthUser, "id" | "email" | "role">) => {
      setStoredToken(nextToken);
      setToken(nextToken);
      updateSessionTimes({ start: true });

      if (fallbackUser) {
        const optimisticUser = {
          id: fallbackUser.id,
          email: fallbackUser.email,
          role: fallbackUser.role,
        } satisfies AuthUser;
        setUser(optimisticUser);
        setStoredUser(optimisticUser);
      }

      try {
        const profile = await api.get<AuthUser>("/auth/me");
        setUser(profile);
        setStoredUser(profile);
        return profile;
      } catch (error) {
        clearAuthStorage();
        setToken(null);
        setUser(null);
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = registerUnauthorizedListener(() => {
      setToken(null);
      setUser(null);
      setLoading(false);
      window.location.assign(routes.signIn);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    void refreshProfile().catch(() => {
      setLoading(false);
    });
  }, [refreshProfile, token]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const onActivity = () => updateSessionTimes();
    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    for (const event of events) {
      window.addEventListener(event, onActivity);
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const interval = window.setInterval(() => {
      const startedAt = getStoredSessionStart();
      const lastActivity = getStoredLastActivity();
      const now = Date.now();

      if (startedAt && now - startedAt > ABSOLUTE_TIMEOUT_MS) {
        logout(routes.signIn);
        return;
      }

      if (lastActivity && now - lastActivity > IDLE_TIMEOUT_MS) {
        logout(routes.signIn);
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [logout, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [loading, login, logout, refreshProfile, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
