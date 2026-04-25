import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";

type SetupResponse = {
  otpauthUrl: string;
  manualEntryKey: string;
};

function normalizeCode(input: string) {
  return input.replace(/\D/g, "").slice(0, 6);
}

export default function MfaSetupPage() {
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSetup() {
      setLoading(true);
      setError("");
      setInfo("");

      try {
        const response = await api.post<SetupResponse>("/auth/mfa/setup");
        if (!active) return;
        setSetup(response);
      } catch (error) {
        if (!active) return;

        if (error instanceof ApiError && error.code === "MFA_ALREADY_ENABLED") {
          setInfo("MFA is already enabled for this OWNER account.");
          setVerified(true);
          return;
        }

        setError(error instanceof Error ? error.message : "Unable to start MFA setup.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadSetup();

    return () => {
      active = false;
    };
  }, []);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setInfo("");

    try {
      await api.post<{ ok: true }>("/auth/mfa/verify-setup", { code });
      setVerified(true);
      setInfo("Authenticator setup verified. MFA is now enabled for your account.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_MFA_CODE") {
        setError("Invalid authentication code. Try again.");
      } else {
        setError(error instanceof Error ? error.message : "Unable to verify this authenticator code.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Security</p>
            <h1>MFA setup</h1>
            <p className="muted">
              Connect an authenticator app to this OWNER account. MFA remains optional until enabled on the backend
              for your account.
            </p>
          </div>
          <Link className="button secondary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>

        {loading ? <p className="muted">Preparing your authenticator setup...</p> : null}
        {error ? <div className="alert error">{error}</div> : null}
        {info ? <div className="alert success">{info}</div> : null}

        {!loading && setup ? (
          <div className="grid-two">
            <div className="info-card">
              <h2>Manual entry key</h2>
              <code className="secret-block">{setup.manualEntryKey}</code>
              <p className="muted">Enter this key into your authenticator app if you cannot scan a QR code.</p>
            </div>

            <div className="info-card">
              <h2>otpauth URL</h2>
              <code className="secret-block">{setup.otpauthUrl}</code>
              <p className="muted">This is shown as text only in Phase 1. QR rendering can be added later.</p>
            </div>
          </div>
        ) : null}

        {!loading && setup && !verified ? (
          <form className="form-stack narrow" onSubmit={handleVerify}>
            <label className="field">
              <span>Authentication code</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(normalizeCode(event.target.value))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
              />
            </label>

            <button className="button primary" type="submit" disabled={submitting || code.length !== 6}>
              {submitting ? "Verifying..." : "Verify setup"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
