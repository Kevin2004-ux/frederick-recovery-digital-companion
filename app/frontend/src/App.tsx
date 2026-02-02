import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setApiNavigator } from "@/api/client";

import Login from "@/pages/Login.tsx";
import Signup from "@/pages/Signup.tsx";
import Verify from "@/pages/Verify.tsx";
import Consent from "@/pages/Consent.tsx";
import Onboarding from "@/pages/Onboarding.tsx";
import RecoveryLog from "@/pages/RecoveryLog.tsx";

function NavigatorBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    setApiNavigator(navigate);
  }, [navigate]);

  return null;
}

function pageLabel(pathname: string): string {
  if (pathname.startsWith("/login")) return "Login";
  if (pathname.startsWith("/signup")) return "Create account";
  if (pathname.startsWith("/verify")) return "Verify email";
  if (pathname.startsWith("/consent")) return "Consent";
  if (pathname.startsWith("/onboarding")) return "Onboarding";
  if (pathname.startsWith("/log")) return "Recovery log";
  return "Frederick Recovery";
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const label = pageLabel(location.pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6">
          <div className="text-sm font-medium text-muted-foreground">
            Frederick Recovery
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Recovery Companion
          </h1>

          <div className="mt-4 text-sm font-medium text-foreground">{label}</div>
        </div>

        {children}

        <div className="mt-10 text-center text-xs text-muted-foreground">
          Patient-owned recovery notes. Export anytime to share with your clinic.
        </div>
      </div>
    </div>
  );
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
          <Route path="/log" element={<RecoveryLog />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}
