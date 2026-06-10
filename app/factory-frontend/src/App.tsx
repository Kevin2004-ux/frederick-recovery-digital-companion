import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { OwnerShell } from "@/components/OwnerShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ActivationCodesPage from "@/pages/ActivationCodes";
import DashboardPage from "@/pages/Dashboard";
import LoginPage from "@/pages/Login";
import MfaSetupPage from "@/pages/MfaSetup";
import OwnerClinicDetailPage from "@/pages/OwnerClinicDetail";
import OwnerClinicsPage from "@/pages/OwnerClinics";
import PlatformUsersPage from "@/pages/PlatformUsers";
import RecoveryLibraryPage from "@/pages/RecoveryLibrary";

function ownerPage(children: ReactNode) {
  return (
    <ProtectedRoute>
      <OwnerShell>{children}</OwnerShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={ownerPage(<DashboardPage />)}
      />
      <Route
        path="/mfa/setup"
        element={
          <ProtectedRoute>
            <MfaSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/clinics"
        element={ownerPage(<OwnerClinicsPage />)}
      />
      <Route
        path="/owner/clinics/:clinicTag"
        element={ownerPage(<OwnerClinicDetailPage />)}
      />
      <Route
        path="/activation-codes"
        element={ownerPage(<ActivationCodesPage />)}
      />
      <Route
        path="/box-items"
        element={ownerPage(<RecoveryLibraryPage focus="box-items" />)}
      />
      <Route
        path="/box-templates"
        element={ownerPage(<RecoveryLibraryPage focus="box-templates" />)}
      />
      <Route
        path="/education-library"
        element={ownerPage(<RecoveryLibraryPage focus="guides" />)}
      />
      <Route
        path="/education-bundles"
        element={ownerPage(<RecoveryLibraryPage focus="bundles" />)}
      />
      <Route
        path="/platform-users"
        element={ownerPage(<PlatformUsersPage />)}
      />
      <Route
        path="/library"
        element={ownerPage(<RecoveryLibraryPage />)}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
