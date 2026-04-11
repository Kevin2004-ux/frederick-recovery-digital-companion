export type UserRole = "PATIENT" | "CLINIC" | "OWNER";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  consentAcceptedAt?: string;
  procedureName?: string;
  recoveryStartDate?: string;
  emailVerifiedAt?: string;
}

export interface LoginResponse {
  token: string;
  user: Pick<AuthUser, "id" | "email" | "role">;
}

export function isPatientOnboardingComplete(user: AuthUser | null | undefined) {
  if (!user || user.role !== "PATIENT") {
    return true;
  }

  return Boolean(user.consentAcceptedAt && user.procedureName && user.recoveryStartDate);
}

export function getHomeRouteForUser(user: AuthUser) {
  if (user.role === "PATIENT") {
    return isPatientOnboardingComplete(user) ? "/patient/home" : "/patient/onboarding";
  }

  return "/clinic/dashboard";
}
