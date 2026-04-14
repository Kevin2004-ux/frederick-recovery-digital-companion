import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { clearToken, getToken } from "@/auth/token";
import { Card } from "@/components/ui/card";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";

type UserRole = "PATIENT" | "CLINIC" | "OWNER";

type AuthMeResponse = {
  id: string;
  email: string;
  role?: UserRole;
};

type RoleGuardProps = {
  allow: UserRole[];
  requirePatientReady?: boolean;
  children: React.ReactNode;
};

function fallbackForRole(role?: UserRole | null) {
  if (role === "CLINIC" || role === "OWNER") return "/clinic";
  return "/home";
}

function isSetupRedirectError(error: unknown) {
  const err = error as Partial<ApiError>;
  return (
    err?.status === 401 ||
    err?.status === 403 ||
    err?.code === "UNAUTHORIZED" ||
    err?.code === "CONSENT_REQUIRED" ||
    err?.code === "ONBOARDING_REQUIRED"
  );
}

export function RoleGuard({
  allow,
  requirePatientReady = false,
  children,
}: RoleGuardProps) {
  const navigate = useNavigate();
  const token = getToken();
  const [loading, setLoading] = useState(Boolean(token));
  const [role, setRole] = useState<UserRole | null>(null);
  const [resolved, setResolved] = useState(false);
  const [patientReady, setPatientReady] = useState<boolean | null>(null);
  const allowsPatient = allow.includes("PATIENT");
  const timeoutEnabled = Boolean(token);

  const handleTimeout = useMemo(
    () => () => {
      clearToken();
      navigate("/login", { replace: true });
    },
    [navigate]
  );

  useSessionTimeout({
    enabled: timeoutEnabled,
    onTimeout: handleTimeout,
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setResolved(true);
      setPatientReady(null);
      return;
    }

    let active = true;

    async function loadRole() {
      setLoading(true);

      try {
        const me = await api<AuthMeResponse>("/auth/me", { method: "GET" });
        if (!active) return;
        setRole(me.role ?? null);
      } catch {
        if (!active) return;
        setRole(null);
      } finally {
        if (active) {
          setLoading(false);
          setResolved(true);
        }
      }
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, [token]);

  const shouldCheckPatientReadiness =
    role === "PATIENT" && (requirePatientReady || !allowsPatient);

  useEffect(() => {
    if (!token || !resolved || role !== "PATIENT" || !shouldCheckPatientReadiness) {
      return;
    }

    let active = true;
    setPatientReady(null);

    async function checkPatientReadiness() {
      try {
        await api("/log/entries", { method: "GET" });
        if (!active) return;
        setPatientReady(true);
      } catch (error) {
        if (!active) return;

        if (isSetupRedirectError(error)) {
          setPatientReady(false);
          return;
        }

        setPatientReady(true);
      }
    }

    void checkPatientReadiness();

    return () => {
      active = false;
    };
  }, [allowsPatient, resolved, requirePatientReady, role, shouldCheckPatientReadiness, token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loading || !resolved || (shouldCheckPatientReadiness && patientReady === null)) {
    return (
      <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Loading access…</h2>
          <p className="text-sm text-muted-foreground">
            Checking your portal access.
          </p>
        </div>
      </Card>
    );
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (role === "PATIENT" && shouldCheckPatientReadiness && patientReady === false) {
    return (
      <Card className="rounded-2xl p-5 shadow-sm sm:p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Loading access…</h2>
          <p className="text-sm text-muted-foreground">
            Checking your portal access.
          </p>
        </div>
      </Card>
    );
  }

  if (!allow.includes(role)) {
    return <Navigate to={fallbackForRole(role)} replace />;
  }

  return <>{children}</>;
}
