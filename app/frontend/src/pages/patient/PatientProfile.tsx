import { LogOut, Save } from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { formatDisplayDate } from "@/lib/date";

export function PatientProfile() {
  const { user, logout, refreshProfile } = useAuth();
  const [procedureName, setProcedureName] = useState(user?.procedureName || "");
  const [recoveryStartDate, setRecoveryStartDate] = useState(user?.recoveryStartDate || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await api.put("/user/profile", {
        procedureName: procedureName.trim(),
        recoveryStartDate,
      });
      await refreshProfile();
      setMessage("Profile updated.");
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to update the profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-5xl">
        <PageIntro
          description="These fields map directly to `/auth/me` and `/user/profile`."
          eyebrow="Patient profile"
          title="Your recovery settings"
        />

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="grid gap-4">
              <div>
                <label className="field-label" htmlFor="profile-procedure">
                  Procedure name
                </label>
                <input
                  className="field"
                  id="profile-procedure"
                  onChange={(event) => setProcedureName(event.target.value)}
                  value={procedureName}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="profile-start-date">
                  Recovery start date
                </label>
                <input
                  className="field"
                  id="profile-start-date"
                  onChange={(event) => setRecoveryStartDate(event.target.value)}
                  type="date"
                  value={recoveryStartDate}
                />
              </div>
            </div>

            {message ? <StatePanel className="mt-5" description={message} title="Profile updated" tone="success" /> : null}
            {error ? <StatePanel className="mt-5" description={error} title="Profile update issue" tone="danger" /> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={loading} onClick={handleSave}>
                <Save className="h-4 w-4" />
                {loading ? "Saving..." : "Save profile"}
              </Button>
              <Button onClick={() => logout()} variant="secondary">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </Card>

          <Card>
            <p className="eyebrow">Current account data</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-900">{user?.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium text-slate-900">{user?.role}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Consent</dt>
                <dd className="font-medium text-slate-900">{user?.consentAcceptedAt ? "Accepted" : "Required"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Recovery start</dt>
                <dd className="font-medium text-slate-900">{formatDisplayDate(user?.recoveryStartDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-slate-900">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <PatientBottomNav />
    </main>
  );
}
