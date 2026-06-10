import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";

type OwnerClinicSummary = {
  clinicTag: string;
  name?: string | null;
  adminUserCount: number;
  totalCodes: number;
  patientCount: number;
  updatedAt: string;
};

type OwnerClinicsResponse = {
  clinics?: OwnerClinicSummary[];
};

function formatListError(error: unknown) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "FORBIDDEN") return "Not authorized.";
  return "We couldn’t load clinic login management right now.";
}

export default function PlatformUsersPage() {
  const [clinics, setClinics] = useState<OwnerClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClinics() {
      setLoading(true);
      setError("");

      try {
        const payload = await api.get<OwnerClinicsResponse>("/owner/clinics");
        if (!active) return;
        setClinics(Array.isArray(payload.clinics) ? payload.clinics : []);
      } catch (nextError) {
        if (!active) return;
        setError(formatListError(nextError));
        setClinics([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadClinics();

    return () => {
      active = false;
    };
  }, []);

  const totalClinicLogins = useMemo(
    () => clinics.reduce((total, clinic) => total + clinic.adminUserCount, 0),
    [clinics],
  );

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Platform Users / Clinic Logins</p>
            <h1>Clinic staff access</h1>
            <p className="muted">
              Clinic logins are for full-platform clinic staff access. Create, view, disable,
              and reset clinic users inside each clinic profile.
            </p>
          </div>
        </div>

        <div className="card-grid">
          <div className="nav-card metric-card">
            <div className="nav-card-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2>Clinic logins</h2>
              <p>{totalClinicLogins}</p>
            </div>
          </div>
          <div className="nav-card metric-card">
            <div className="nav-card-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2>Clinics</h2>
              <p>{clinics.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Staff login management</p>
            <h2>Choose a clinic</h2>
            <p className="muted">
              Open a clinic profile and use the Clinic users / logins section. These controls are
              intentionally tied to a clinic tag so clinic users stay scoped to their own clinic.
            </p>
          </div>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        <div className="library-module-list">
          {loading ? (
            <div className="library-picker-empty">
              <Loader2 size={18} className="spin" />
              Loading clinics…
            </div>
          ) : clinics.length === 0 ? (
            <div className="library-picker-empty">No clinics are available yet.</div>
          ) : (
            clinics.map((clinic) => (
              <Link
                key={clinic.clinicTag}
                className="library-module-row"
                to={`/owner/clinics/${clinic.clinicTag}#clinic-users`}
              >
                <div className="library-module-row-top">
                  <div className="library-module-title">
                    {clinic.name || clinic.clinicTag}
                  </div>
                  <div className="status-pill active">{clinic.adminUserCount} login(s)</div>
                </div>
                <div className="library-module-row-meta">
                  <span>{clinic.clinicTag}</span>
                  <span>{clinic.totalCodes} activation codes</span>
                  <span>{clinic.patientCount} patients</span>
                  <span>
                    Manage logins <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
