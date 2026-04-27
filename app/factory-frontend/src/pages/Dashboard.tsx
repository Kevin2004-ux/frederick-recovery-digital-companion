import { ArrowRight, Boxes, Building2, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { clearSession, getStoredUser } from "@/lib/session";
import type { ActivationBatch, CreateBatchResponse } from "@/types";

type BatchesResponse = {
  batches: ActivationBatch[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [batches, setBatches] = useState<ActivationBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchError, setBatchError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdBatch, setCreatedBatch] = useState<ActivationBatch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clinicTag, setClinicTag] = useState("");
  const [quantity, setQuantity] = useState("25");
  const [boxType, setBoxType] = useState("");

  const cards = useMemo(
    () => [
      {
        title: "Activation batches",
        description: "Review recent activation runs and issue new clinic batches.",
        href: "#activation-batches",
        icon: Boxes,
      },
      {
        title: "MFA setup",
        description: "Connect an authenticator app for this OWNER account.",
        href: "/mfa/setup",
        icon: KeyRound,
      },
      {
        title: "Clinic Management",
        description: "Create clinics, manage clinic admins, and export clinic code activity.",
        href: "/owner/clinics",
        icon: Building2,
      },
      {
        title: "System status",
        description: "Reserved for owner-level environment checks in a later phase.",
        href: "#system-status",
        icon: ShieldCheck,
      },
    ],
    [],
  );

  useEffect(() => {
    let active = true;

    async function loadBatches() {
      setBatchesLoading(true);
      setBatchError("");

      try {
        const response = await api.get<BatchesResponse>("/clinic/batches?limit=12");
        if (!active) return;
        setBatches(response.batches);
      } catch (error) {
        if (!active) return;
        setBatchError(error instanceof Error ? error.message : "Unable to load activation batches.");
      } finally {
        if (active) setBatchesLoading(false);
      }
    }

    void loadBatches();

    return () => {
      active = false;
    };
  }, []);

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  async function handleCreateBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setCreateError("");

    try {
      const response = await api.post<CreateBatchResponse>("/clinic/batches", {
        clinicTag: clinicTag.trim(),
        quantity: Number(quantity),
        ...(boxType.trim() ? { boxType: boxType.trim() } : {}),
      });

      setCreatedBatch(response.batch);
      setClinicTag("");
      setQuantity("25");
      setBoxType("");
      setBatches((current) => [response.batch, ...current].slice(0, 12));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create activation batch.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="panel hero-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Owner Dashboard</p>
            <h1>Frederick Recovery Factory</h1>
            <p className="muted">
              Signed in as <strong>{user?.email ?? "OWNER"}</strong>
            </p>
          </div>
          <button className="button secondary" type="button" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="card-grid">
          {cards.map((card) => {
            const Icon = card.icon;
            const isAnchor = card.href.startsWith("#");

            return isAnchor ? (
              <a key={card.title} className="nav-card" href={card.href}>
                <div className="nav-card-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <ArrowRight size={18} />
              </a>
            ) : (
              <Link key={card.title} className="nav-card" to={card.href}>
                <div className="nav-card-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <h2>{card.title}</h2>
                  <p>{card.description}</p>
                </div>
                <ArrowRight size={18} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="panel" id="activation-batches">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activation batches</p>
            <h2>Recent runs</h2>
            <p className="muted">Create a batch and review recent code runs from the existing backend API.</p>
          </div>
        </div>

        <div className="grid-two">
          <form className="info-card form-stack" onSubmit={handleCreateBatch}>
            <h3>Create batch</h3>
            <label className="field">
              <span>Clinic tag</span>
              <input
                type="text"
                value={clinicTag}
                onChange={(event) => setClinicTag(event.target.value)}
                placeholder="north-campus"
                required
              />
            </label>

            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                value={quantity}
                min={1}
                max={5000}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Box type (optional)</span>
              <input
                type="text"
                value={boxType}
                onChange={(event) => setBoxType(event.target.value)}
                placeholder="Standard Recovery Box"
              />
            </label>

            {createError ? <div className="alert error">{createError}</div> : null}

            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? "Creating batch..." : "Create activation batch"}
            </button>
          </form>

          <div className="info-card">
            <h3>Latest created batch</h3>
            {createdBatch ? (
              <dl className="meta-list">
                <div>
                  <dt>Batch ID</dt>
                  <dd>{createdBatch.id}</dd>
                </div>
                <div>
                  <dt>Clinic tag</dt>
                  <dd>{createdBatch.clinicTag ?? "None"}</dd>
                </div>
                <div>
                  <dt>Quantity</dt>
                  <dd>{createdBatch.quantity}</dd>
                </div>
                <div>
                  <dt>Box type</dt>
                  <dd>{createdBatch.boxType ?? "Not set"}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">Create a batch to show its result here.</p>
            )}
          </div>
        </div>

        {batchError ? <div className="alert error">{batchError}</div> : null}

        <div className="table-wrap">
          {batchesLoading ? (
            <p className="muted">Loading recent batches...</p>
          ) : batches.length === 0 ? (
            <p className="muted">No activation batches were returned.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Quantity</th>
                  <th>Box type</th>
                  <th>Counts</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div className="cell-strong">{batch.clinicTag ?? "All clinics"}</div>
                      <div className="cell-muted">{batch.id}</div>
                    </td>
                    <td>{batch.quantity}</td>
                    <td>{batch.boxType ?? "Not set"}</td>
                    <td>
                      {batch.codeCounts
                        ? `${batch.codeCounts.unused} unused / ${batch.codeCounts.claimed} claimed`
                        : "Counts unavailable"}
                    </td>
                    <td>{formatDate(batch.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="panel" id="system-status">
        <div className="section-heading">
          <div>
            <p className="eyebrow">System status</p>
            <h2>Placeholder</h2>
            <p className="muted">This owner app foundation keeps space for status tooling without changing backend APIs.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
