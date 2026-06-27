import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, setApiNavigator } from "@/api/client";

import Login from "@/pages/Login.tsx";
import Signup from "@/pages/Signup.tsx";
import Verify from "@/pages/Verify.tsx";
import Consent from "@/pages/Consent.tsx";
import Onboarding from "@/pages/Onboarding.tsx";
import PatientHome from "@/pages/PatientHome.tsx";
import MyBoxItemDetail from "@/pages/MyBoxItemDetail.tsx";
import MedicalHub from "@/pages/MedicalHub.tsx";
import MedicalLibraryCategory from "@/pages/MedicalLibraryCategory.tsx";
import MedicalLibraryGuide from "@/pages/MedicalLibraryGuide.tsx";
import Resources from "@/pages/Resources.tsx";
import RecoveryLog from "@/pages/RecoveryLog.tsx";
import ClinicDashboard from "@/pages/ClinicDashboard.tsx";
import ClinicPatientDetail from "@/pages/ClinicPatientDetail.tsx";
import OwnerClinics from "@/pages/OwnerClinics.tsx";
import OwnerClinicDetail from "@/pages/OwnerClinicDetail.tsx";
import { RoleGuard } from "@/components/auth/RoleGuard";
import type { RecoveryLibraryHomePayload } from "@/types";

function NavigatorBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    setApiNavigator(navigate);
  }, [navigate]);

  return null;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 text-foreground">
      <div className="flex min-h-screen w-full flex-col px-4 py-5 sm:px-5 sm:py-8 lg:px-8">
        <div className="mb-6 w-full sm:mb-8">
          <div className="text-xs font-medium tracking-[0.08em] text-stone-500">
            Frederick Recovery
          </div>
        </div>

        <div className="flex-1 w-full">{children}</div>
      </div>
    </div>
  );
}

function PatientTrackerRoute() {
  const allowed = useAllowedTracker();

  if (allowed === null) {
    return (
      <div className="mx-auto w-full max-w-3xl rounded-[30px] border border-black/5 bg-white/95 p-5 text-sm text-muted-foreground shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        Loading recovery tools…
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/medical-hub?tab=procedure" replace />;
  }

  return <RecoveryLog />;
}

function useAllowedTracker() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProductMode() {
      try {
        const payload = await api<RecoveryLibraryHomePayload>("/education/library", {
          method: "GET",
        });
        if (!active) return;
        setAllowed(payload.personalized.productMode !== "kit_only");
      } catch {
        if (!active) return;
        setAllowed(true);
      }
    }

    void loadProductMode();

    return () => {
      active = false;
    };
  }, []);

  return allowed;
}

export default function App() {
  return (
    <>
      <NavigatorBridge />

      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />

          <Route path="/consent" element={<Consent />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/home"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <PatientHome />
              </RoleGuard>
            }
          />
          <Route
            path="/my-box"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <Navigate to="/medical-hub?tab=kit" replace />
              </RoleGuard>
            }
          />
          <Route
            path="/my-box/:itemKey"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <MyBoxItemDetail />
              </RoleGuard>
            }
          />
          <Route
            path="/medical-hub"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <MedicalHub />
              </RoleGuard>
            }
          />
          <Route
            path="/medical-hub/categories/:categoryKey"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <MedicalLibraryCategory />
              </RoleGuard>
            }
          />
          <Route
            path="/medical-hub/guides/:guideId"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <MedicalLibraryGuide />
              </RoleGuard>
            }
          />
          <Route
            path="/resources"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <Resources />
              </RoleGuard>
            }
          />
          <Route
            path="/clinic"
            element={
              <RoleGuard allow={["CLINIC", "OWNER"]}>
                <ClinicDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/clinic/patients/:patientId"
            element={
              <RoleGuard allow={["CLINIC", "OWNER"]}>
                <ClinicPatientDetail />
              </RoleGuard>
            }
          />
          <Route
            path="/owner/clinics"
            element={
              <RoleGuard allow={["OWNER"]}>
                <OwnerClinics />
              </RoleGuard>
            }
          />
          <Route
            path="/owner/clinics/:clinicTag"
            element={
              <RoleGuard allow={["OWNER"]}>
                <OwnerClinicDetail />
              </RoleGuard>
            }
          />
          <Route
            path="/log"
            element={
              <RoleGuard allow={["PATIENT"]} requirePatientReady>
                <PatientTrackerRoute />
              </RoleGuard>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}
