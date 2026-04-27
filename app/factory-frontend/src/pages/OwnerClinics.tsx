import { Building2, Download, PlusCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";

type OwnerClinicSummary = {
  clinicTag: string;
  name?: string | null;
  createdAt: string;
  updatedAt: string;
  adminUserCount: number;
  batchCount: number;
  totalCodes: number;
  issuedCodes: number;
  draftCodes: number;
  approvedCodes: number;
  claimedCodes: number;
  invalidatedCodes: number;
  patientCount: number;
};

type OwnerClinicsResponse = {
  clinics?: OwnerClinicSummary[];
};

type CreateClinicResponse = {
  clinic: {
    clinicTag: string;
    name?: string | null;
  };
  adminUser: {
    id: string;
    email: string;
    role: "CLINIC";
    clinicTag: string;
    mfaEnabled: boolean;
    mfaRequired: boolean;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function normalizeClinicTag(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatCreateError(error: unknown) {
  const apiError = error as Partial<ApiError>;

  if (apiError?.code === "EMAIL_ALREADY_EXISTS") {
    return "That email is already attached to another account.";
  }

  if (apiError?.code === "CLINIC_ADMIN_ALREADY_EXISTS") {
    return "That clinic admin already exists.";
  }

  if (apiError?.code === "VALIDATION_ERROR") {
    return "Please review the clinic form and try again.";
  }

  return "We couldn’t create the clinic right now. Please try again.";
}

function formatListError(error: unknown) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "FORBIDDEN") return "Not authorized.";
  return "We couldn’t load clinic management right now.";
}

export default function OwnerClinicsPage() {
  const [clinics, setClinics] = useState<OwnerClinicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingClinicTag, setDownloadingClinicTag] = useState<string | null>(null);
  const [form, setForm] = useState({
    clinicName: "",
    clinicTag: "",
    adminEmail: "",
    temporaryPassword: "",
    requireMfa: true,
  });

  async function loadClinics() {
    setLoading(true);
    setError("");

    try {
      const payload = await api.get<OwnerClinicsResponse>("/owner/clinics");
      setClinics(Array.isArray(payload?.clinics) ? payload.clinics : []);
    } catch (nextError) {
      setError(formatListError(nextError));
      setClinics([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClinics();
  }, []);

  const stats = useMemo(
    () =>
      clinics.reduce(
        (acc, clinic) => {
          acc.totalClinics += 1;
          acc.totalCodes += clinic.totalCodes;
          acc.totalAdmins += clinic.adminUserCount;
          acc.totalPatients += clinic.patientCount;
          return acc;
        },
        { totalClinics: 0, totalCodes: 0, totalAdmins: 0, totalPatients: 0 },
      ),
    [clinics],
  );

  async function handleCreateClinic(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    setSubmitting(true);

    try {
      const payload = await api.post<CreateClinicResponse>("/owner/clinics", {
        clinicName: form.clinicName.trim(),
        clinicTag: normalizeClinicTag(form.clinicTag),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        temporaryPassword: form.temporaryPassword,
        requireMfa: form.requireMfa,
      });

      setSubmitSuccess(
        `Clinic ${payload.clinic.clinicTag} created. Admin login ready for ${payload.adminUser.email}.`,
      );
      setForm({
        clinicName: "",
        clinicTag: "",
        adminEmail: "",
        temporaryPassword: "",
        requireMfa: true,
      });
      await loadClinics();
    } catch (nextError) {
      setSubmitError(formatCreateError(nextError));
      setForm((current) => ({ ...current, temporaryPassword: "" }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadClinicCsv(clinicTag: string) {
    setDownloadingClinicTag(clinicTag);
    setError("");

    try {
      const blob = await api.blob(`/owner/clinics/${clinicTag}/codes.csv`);
      downloadBlob(blob, `activation-codes-${clinicTag}.csv`);
    } catch (nextError) {
      setError(formatListError(nextError));
    } finally {
      setDownloadingClinicTag(null);
    }
  }

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Owner Tools</p>
            <h1>Clinic management</h1>
            <p className="muted">
              Create clinic admin accounts, review generated code activity, and download clinic-level CSV exports.
            </p>
          </div>

          <div className="inline-note compact-note">
            <span>Scope</span>
            <strong>OWNER only</strong>
          </div>
        </div>

        <div className="card-grid">
          {[
            { label: "Clinics", value: stats.totalClinics, icon: Building2 },
            { label: "Admin users", value: stats.totalAdmins, icon: ShieldCheck },
            { label: "Activation codes", value: stats.totalCodes, icon: Download },
            { label: "Patients claimed", value: stats.totalPatients, icon: PlusCircle },
          ].map((metric) => {
            const Icon = metric.icon;

            return (
              <div key={metric.label} className="nav-card metric-card">
                <div className="nav-card-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <h2>{metric.label}</h2>
                  <p>{metric.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid-two owner-layout">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Create clinic</p>
              <h2>Provision a clinic</h2>
              <p className="muted">
                Create the clinic profile and first clinic admin login in one step.
              </p>
            </div>
          </div>

          <form className="form-stack owner-form" onSubmit={handleCreateClinic}>
            <label className="field">
              <span>Clinic name</span>
              <input
                value={form.clinicName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, clinicName: event.target.value }))
                }
                placeholder="Tallahassee Orthopedic Clinic"
                required
              />
            </label>

            <label className="field">
              <span>Clinic tag</span>
              <input
                value={form.clinicTag}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    clinicTag: normalizeClinicTag(event.target.value),
                  }))
                }
                placeholder="tallahassee-ortho"
                required
              />
            </label>

            <label className="field">
              <span>Admin email</span>
              <input
                type="email"
                value={form.adminEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, adminEmail: event.target.value }))
                }
                placeholder="admin@clinic.com"
                required
              />
            </label>

            <label className="field">
              <span>Temporary password</span>
              <input
                type="password"
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    temporaryPassword: event.target.value,
                  }))
                }
                placeholder="TempPassword123!"
                required
              />
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.requireMfa}
                onChange={(event) =>
                  setForm((current) => ({ ...current, requireMfa: event.target.checked }))
                }
              />
              <span>Require MFA checkbox</span>
            </label>

            {submitError ? <div className="alert error">{submitError}</div> : null}
            {submitSuccess ? <div className="alert success">{submitSuccess}</div> : null}

            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? "Creating clinic..." : "Create Clinic"}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">All clinics</p>
              <h2>Owner clinic list</h2>
              <p className="muted">
                Review clinic activity, open detail views, and download full clinic CSV exports.
              </p>
            </div>
          </div>

          {error ? <div className="alert error">{error}</div> : null}

          <div className="table-wrap owner-table-wrap">
            {loading ? (
              <p className="muted">Loading clinics...</p>
            ) : clinics.length === 0 ? (
              <p className="muted">No clinics yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Clinic name</th>
                    <th>Clinic tag</th>
                    <th>Admin users</th>
                    <th>Total codes</th>
                    <th>Issued</th>
                    <th>Draft</th>
                    <th>Approved</th>
                    <th>Claimed</th>
                    <th>Invalidated</th>
                    <th>Patient count</th>
                    <th>Batch count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((clinic) => (
                    <tr key={clinic.clinicTag}>
                      <td>
                        <div className="cell-strong">{clinic.name || "Unnamed clinic"}</div>
                        <div className="cell-muted">Updated {formatDate(clinic.updatedAt)}</div>
                      </td>
                      <td>{clinic.clinicTag}</td>
                      <td>{clinic.adminUserCount}</td>
                      <td>{clinic.totalCodes}</td>
                      <td>{clinic.issuedCodes}</td>
                      <td>{clinic.draftCodes}</td>
                      <td>{clinic.approvedCodes}</td>
                      <td>{clinic.claimedCodes}</td>
                      <td>{clinic.invalidatedCodes}</td>
                      <td>{clinic.patientCount}</td>
                      <td>{clinic.batchCount}</td>
                      <td>
                        <div className="action-stack">
                          <Link className="button secondary action-button" to={`/owner/clinics/${clinic.clinicTag}`}>
                            View Details
                          </Link>
                          <button
                            className="button secondary action-button"
                            type="button"
                            onClick={() => void handleDownloadClinicCsv(clinic.clinicTag)}
                            disabled={downloadingClinicTag === clinic.clinicTag}
                          >
                            {downloadingClinicTag === clinic.clinicTag ? "Downloading..." : "Download Clinic CSV"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
