import type { AuthUser } from "@/types/auth";
import { getHomeRouteForUser } from "@/types/auth";

export const routes = {
  root: "/",
  signIn: "/sign-in",
  activate: "/activate",
  verifyEmail: "/verify-email",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  patientOnboarding: "/patient/onboarding",
  patientHome: "/patient/home",
  patientTracker: "/patient/tracker",
  patientProfile: "/patient/profile",
  patientMyBox: "/patient/my-box",
  patientMyBoxItem: "/patient/my-box/:itemKey",
  patientMedicalHub: "/patient/medical-hub",
  patientMedicalHubMed: "/patient/medical-hub/medication",
  patientMedicalHubRecovery: "/patient/medical-hub/recovery",
  clinicDashboard: "/clinic/dashboard",
  clinicCodeManager: "/clinic/code-manager",
  clinicPatientDetail: "/clinic/patient/:patientId",
} as const;

export function resolveAfterSignIn(user: AuthUser) {
  return getHomeRouteForUser(user);
}

export function buildVerifyEmailRoute(email: string) {
  return `${routes.verifyEmail}?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

export function buildPatientMyBoxItemRoute(itemKey: string) {
  return routes.patientMyBoxItem.replace(":itemKey", encodeURIComponent(itemKey));
}

export function buildClinicPatientDetailRoute(patientId: string) {
  return routes.clinicPatientDetail.replace(":patientId", encodeURIComponent(patientId));
}
