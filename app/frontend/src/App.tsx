import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { resolveAfterSignIn, routes } from "@/lib/routes";
import { Landing } from "@/pages/public/Landing";
import { SignIn } from "@/pages/public/SignIn";
import { Activate } from "@/pages/public/Activate";
import { VerifyEmail } from "@/pages/public/VerifyEmail";
import { ForgotPassword } from "@/pages/public/ForgotPassword";
import { ResetPassword } from "@/pages/public/ResetPassword";
import { PatientOnboarding } from "@/pages/patient/PatientOnboarding";
import { PatientHome } from "@/pages/patient/PatientHome";
import { PatientTracker } from "@/pages/patient/PatientTracker";
import { PatientProfile } from "@/pages/patient/PatientProfile";
import { MyBox } from "@/pages/patient/MyBox";
import { MyBoxItemDetail } from "@/pages/patient/MyBoxItemDetail";
import { MedicalHub } from "@/pages/patient/MedicalHub";
import { MedicalHubMedDetail } from "@/pages/patient/MedicalHubMedDetail";
import { MedicalHubRecoveryDetail } from "@/pages/patient/MedicalHubRecoveryDetail";
import { ClinicDashboard } from "@/pages/clinic/ClinicDashboard";
import { ClinicCodeManager } from "@/pages/clinic/ClinicCodeManager";
import { ClinicPatientDetail } from "@/pages/clinic/ClinicPatientDetail";
function AuthenticatedIndexRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading Frederick Recovery...</div>;
  }

  if (!user) {
    return <Landing />;
  }

  return <Navigate replace to={resolveAfterSignIn(user)} />;
}

function NotFound() {
  return (
    <main className="min-h-screen bg-app px-6 py-16">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/60 bg-white/85 p-10 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">
          Page not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          This path is not part of the current recovery app.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Use the secure navigation links to return to sign in, your recovery home, or the clinic
          dashboard.
        </p>
        <Link className="button-primary mt-8 inline-flex" to={routes.root}>
          Return home
        </Link>
      </div>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={routes.root} element={<AuthenticatedIndexRedirect />} />
      <Route path={routes.signIn} element={<SignIn />} />
      <Route path={routes.activate} element={<Activate />} />
      <Route path={routes.verifyEmail} element={<VerifyEmail />} />
      <Route path={routes.forgotPassword} element={<ForgotPassword />} />
      <Route path={routes.resetPassword} element={<ResetPassword />} />

      <Route
        path={routes.patientOnboarding}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]} requireOnboarding={false}>
            <PatientOnboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientHome}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientHome />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientTracker}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <PatientTracker />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientProfile}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]} requireOnboarding={false}>
            <PatientProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientMyBox}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <MyBox />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientMyBoxItem}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <MyBoxItemDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientMedicalHub}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <MedicalHub />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientMedicalHubMed}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <MedicalHubMedDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.patientMedicalHubRecovery}
        element={
          <ProtectedRoute allowedRoles={["PATIENT"]}>
            <MedicalHubRecoveryDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path={routes.clinicDashboard}
        element={
          <ProtectedRoute allowedRoles={["CLINIC", "OWNER"]} requireOnboarding={false}>
            <ClinicDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.clinicCodeManager}
        element={
          <ProtectedRoute allowedRoles={["CLINIC", "OWNER"]} requireOnboarding={false}>
            <ClinicCodeManager />
          </ProtectedRoute>
        }
      />
      <Route
        path={routes.clinicPatientDetail}
        element={
          <ProtectedRoute allowedRoles={["CLINIC", "OWNER"]} requireOnboarding={false}>
            <ClinicPatientDetail />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
