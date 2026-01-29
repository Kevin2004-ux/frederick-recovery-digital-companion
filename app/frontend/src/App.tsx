import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { setApiNavigator } from "@/api/client";

import Login from "@/pages/Login.tsx";
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

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const steps = [
    { label: "Login", path: "/login" },
    { label: "Consent", path: "/consent" },
    { label: "Onboarding", path: "/onboarding" },
    { label: "Log", path: "/log" },
  ];

  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => location.pathname.startsWith(s.path))
  );

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

          <div className="mt-4 flex items-center justify-between gap-2">
            {steps.map((s, i) => {
              const isActive = i === activeIndex;
              const isDone = i < activeIndex;
              return (
                <div key={s.path} className="flex-1">
                  <div
                    className={[
                      "h-2 w-full rounded-full",
                      isActive
                        ? "bg-foreground"
                        : isDone
                          ? "bg-muted-foreground/60"
                          : "bg-muted",
                    ].join(" ")}
                  />
                  <div
                    className={[
                      "mt-2 text-[11px]",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
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
          <Route path="/consent" element={<Consent />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/log" element={<RecoveryLog />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}
