import type { ReactNode } from "react";

import { Navigate } from "react-router-dom";

import { useAuth } from "@/components/auth/AuthProvider";
import { resolveAfterSignIn, routes } from "@/lib/routes";
import { isPatientOnboardingComplete, type UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireOnboarding?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireOnboarding = true,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Securing your workspace...</div>;
  }

  if (!user) {
    return <Navigate replace to={routes.signIn} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate replace to={resolveAfterSignIn(user)} />;
  }

  if (requireOnboarding && user.role === "PATIENT" && !isPatientOnboardingComplete(user)) {
    return <Navigate replace to={routes.patientOnboarding} />;
  }

  return <>{children}</>;
}
