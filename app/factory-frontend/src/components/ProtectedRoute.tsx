import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { api, ApiError } from "@/api/client";
import { clearSession, getStoredToken, isOwnerUser, setStoredUser } from "@/lib/session";
import type { AuthMeResponse } from "@/types";

type Props = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let active = true;

    async function validateOwnerSession() {
      const token = getStoredToken();
      if (!token) {
        if (active) setStatus("denied");
        return;
      }

      try {
        const profile = await api.get<AuthMeResponse>("/auth/me");
        if (!active) return;

        if (!isOwnerUser(profile)) {
          clearSession();
          setStatus("denied");
          return;
        }

        setStoredUser(profile);
        setStatus("allowed");
      } catch (error) {
        if (!active) return;

        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearSession();
        }

        setStatus("denied");
      }
    }

    void validateOwnerSession();

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="page-shell">
        <div className="panel status-panel">
          <p className="eyebrow">Owner Session</p>
          <h1>Checking your session</h1>
          <p className="muted">Confirming OWNER access with the backend.</p>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
