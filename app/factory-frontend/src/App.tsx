import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardPage from "@/pages/Dashboard";
import LoginPage from "@/pages/Login";
import MfaSetupPage from "@/pages/MfaSetup";
import OwnerClinicDetailPage from "@/pages/OwnerClinicDetail";
import OwnerClinicsPage from "@/pages/OwnerClinics";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
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
        element={
          <ProtectedRoute>
            <OwnerClinicsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner/clinics/:clinicTag"
        element={
          <ProtectedRoute>
            <OwnerClinicDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
