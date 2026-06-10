import { Loader2, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import type {
  ActivationCodeDetail,
  ActivationCodeDetailResponse,
  ActivationCodeEducationOverrides,
  RecoveryLibraryAdminPayload,
  RecoveryLibraryProductMode,
} from "@/types";

type ActivationCodeRow = {
  code: string;
  status: string;
  clinicTag?: string | null;
  batchId?: string | null;
  educationBundleId?: string | null;
  boxTemplateId?: string | null;
  productMode?: RecoveryLibraryProductMode;
  procedureName?: string | null;
  assignedEducation?: ActivationCodeEducationOverrides;
  createdAt?: string;
  claimedAt?: string | null;
  claimedByUserId?: string | null;
};

type ActivationCodesResponse = {
  codes?: ActivationCodeRow[];
};

function formatProductMode(productMode?: RecoveryLibraryProductMode | null) {
  return productMode === "kit_only" ? "Kit-only education" : "Full platform";
}

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

function idsToText(ids: string[] = []) {
  return ids.join("\n");
}

function parseIdsText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function formatError(error: unknown, fallback: string) {
  const apiError = error as Partial<ApiError>;
  if (apiError?.code === "VALIDATION_ERROR") return "Please review the fields and try again.";
  if (apiError?.code === "NOT_FOUND") return "Activation code was not found.";
  return fallback;
}

export default function ActivationCodesPage() {
  const [codes, setCodes] = useState<ActivationCodeRow[]>([]);
  const [libraryPayload, setLibraryPayload] = useState<RecoveryLibraryAdminPayload | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [productMode, setProductMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCode, setSelectedCode] = useState<ActivationCodeDetail | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    educationBundleId: "",
    boxTemplateId: "",
    procedureName: "",
    productMode: "full_platform" as RecoveryLibraryProductMode,
    guideIdsText: "",
    recommendedGuideIdsText: "",
  });

  async function loadCodes() {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    if (productMode) params.set("productMode", productMode);
    params.set("limit", "500");

    try {
      const payload = await api.get<ActivationCodesResponse>(
        `/owner/activation-codes?${params.toString()}`,
      );
      setCodes(Array.isArray(payload.codes) ? payload.codes : []);
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t load activation codes right now."));
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadLibraryOptions() {
      try {
        const payload = await api.get<RecoveryLibraryAdminPayload>("/education/library/admin");
        if (active) setLibraryPayload(payload);
      } catch {
        if (active) setLibraryPayload(null);
      }
    }

    void loadCodes();
    void loadLibraryOptions();

    return () => {
      active = false;
    };
  }, []);

  async function openCode(code: string) {
    setSelectedLoading(true);
    setNotice("");
    setError("");

    try {
      const payload = await api.get<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(code)}`,
      );
      const activationCode = payload.activationCode;
      setSelectedCode(activationCode);
      setForm({
        educationBundleId:
          activationCode.educationBundleId ?? activationCode.effectiveEducationBundleId ?? "",
        boxTemplateId: activationCode.boxTemplateId ?? activationCode.effectiveBoxTemplateId ?? "",
        procedureName: activationCode.procedureName ?? activationCode.effectiveProcedureName ?? "",
        productMode: activationCode.productMode ?? activationCode.effectiveProductMode ?? "full_platform",
        guideIdsText: idsToText(activationCode.assignedEducation.guideIds),
        recommendedGuideIdsText: idsToText(activationCode.assignedEducation.recommendedGuideIds),
      });
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t open that activation code."));
    } finally {
      setSelectedLoading(false);
    }
  }

  async function saveCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = await api.put<ActivationCodeDetailResponse>(
        `/owner/activation-codes/${encodeURIComponent(selectedCode.code)}`,
        {
          educationBundleId: form.educationBundleId || null,
          boxTemplateId: form.boxTemplateId || null,
          procedureName: form.procedureName.trim() || null,
          productMode: form.productMode,
          assignedEducation: {
            guideIds: parseIdsText(form.guideIdsText),
            recommendedGuideIds: parseIdsText(form.recommendedGuideIdsText),
          },
        },
      );
      setSelectedCode(payload.activationCode);
      setNotice(`Saved ${payload.activationCode.code}.`);
      await loadCodes();
    } catch (nextError) {
      setError(formatError(nextError, "We couldn’t save that activation code."));
    } finally {
      setSaving(false);
    }
  }

  const selectedModeCopy = useMemo(() => {
    if (form.productMode === "kit_only") {
      return "Kit-only education shows the patient library, box items, education guides, videos, and instructions only.";
    }

    return "Full platform codes can use the complete recovery platform, including clinic dashboard features, logs, check-ins, tracking, and alerts.";
  }, [form.productMode]);

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activation Codes</p>
            <h1>Search and configure codes</h1>
            <p className="muted">
              Find a code across clinics, confirm product mode, and assign the right education
              bundle and box template.
            </p>
          </div>
        </div>

        <div className="inline-note">
          <span>Main workflow: Clinic → Generate Codes → Configure Code → Assign Box Items/Education → Preview Patient View</span>
        </div>
      </section>

      <section className="panel form-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Find a code</p>
            <h2>Activation-code search</h2>
          </div>
        </div>

        <div className="grid-two">
          <label className="field">
            <span>Search code, clinic, or procedure</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Any status</option>
              <option value="ISSUED">Unused</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="CLAIMED">Claimed</option>
              <option value="INVALIDATED">Invalidated</option>
            </select>
          </label>
          <label className="field">
            <span>Product mode</span>
            <select value={productMode} onChange={(event) => setProductMode(event.target.value)}>
              <option value="">Any mode</option>
              <option value="kit_only">Kit-only education</option>
              <option value="full_platform">Full platform</option>
            </select>
          </label>
          <div className="action-stack">
            <button className="button primary action-button" type="button" onClick={() => void loadCodes()}>
              <Search size={16} />
              Search
            </button>
          </div>
        </div>

        {error ? <div className="alert error">{error}</div> : null}
        {notice ? <div className="alert success">{notice}</div> : null}
      </section>

      <section className="library-admin-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Results</p>
              <h2>{codes.length} activation codes</h2>
            </div>
          </div>

          <div className="library-module-list">
            {loading ? (
              <div className="library-picker-empty">Loading activation codes…</div>
            ) : codes.length === 0 ? (
              <div className="library-picker-empty">No activation codes match that search.</div>
            ) : (
              codes.map((code) => (
                <button
                  key={code.code}
                  type="button"
                  className={`library-module-row ${selectedCode?.code === code.code ? "selected" : ""}`}
                  onClick={() => void openCode(code.code)}
                >
                  <div className="library-module-row-top">
                    <div className="library-module-title">{code.code}</div>
                    <div className="status-pill active">{formatProductMode(code.productMode)}</div>
                  </div>
                  <div className="library-module-row-meta">
                    <span>{code.clinicTag || "No clinic"}</span>
                    <span>{code.status}</span>
                    {code.procedureName ? <span>{code.procedureName}</span> : null}
                    <span>{formatDate(code.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Configure code</p>
              <h2>{selectedCode ? selectedCode.code : "Select a code"}</h2>
              <p className="muted">
                Use the clinic profile for detailed final box item add/remove controls.
              </p>
            </div>
          </div>

          {selectedLoading ? (
            <div className="inline-note">
              <span>Loading code configuration…</span>
              <Loader2 size={18} className="spin" />
            </div>
          ) : selectedCode ? (
            <form className="form-stack" onSubmit={saveCode}>
              <div className="inline-note">
                <span>{selectedModeCopy}</span>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span>Product mode</span>
                  <select
                    value={form.productMode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        productMode: event.target.value as RecoveryLibraryProductMode,
                      }))
                    }
                  >
                    <option value="kit_only">Kit-only education</option>
                    <option value="full_platform">Full platform</option>
                  </select>
                </label>

                <label className="field">
                  <span>Procedure</span>
                  <input
                    value={form.procedureName}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, procedureName: event.target.value }))
                    }
                    placeholder="Knee Replacement"
                  />
                </label>

                <label className="field">
                  <span>Education bundle</span>
                  <select
                    value={form.educationBundleId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        educationBundleId: event.target.value,
                      }))
                    }
                  >
                    <option value="">No bundle</option>
                    {(libraryPayload?.bundles ?? []).map((bundle) => (
                      <option key={bundle.id} value={bundle.id}>
                        {bundle.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Box template</span>
                  <select
                    value={form.boxTemplateId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, boxTemplateId: event.target.value }))
                    }
                  >
                    <option value="">No template</option>
                    {(libraryPayload?.boxTemplates ?? []).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <details className="advanced-panel">
                <summary>Advanced education guide overrides</summary>
                <div className="grid-two">
                  <label className="field">
                    <span>Selected guide IDs</span>
                    <textarea
                      value={form.guideIdsText}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, guideIdsText: event.target.value }))
                      }
                      rows={4}
                    />
                  </label>
                  <label className="field">
                    <span>Recommended guide IDs</span>
                    <textarea
                      value={form.recommendedGuideIdsText}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          recommendedGuideIdsText: event.target.value,
                        }))
                      }
                      rows={4}
                    />
                  </label>
                </div>
              </details>

              <div className="form-actions">
                <button className="button primary" type="submit" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                  Save code
                </button>
                {selectedCode.clinicTag ? (
                  <Link
                    className="button secondary"
                    to={`/owner/clinics/${selectedCode.clinicTag}#code-assignment-editor`}
                  >
                    Open clinic profile
                  </Link>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="muted">Choose an activation code from the list to configure it.</p>
          )}
        </div>
      </section>
    </div>
  );
}
