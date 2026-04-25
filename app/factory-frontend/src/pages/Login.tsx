import { Shield, KeyRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { getStoredToken, getStoredUser, isOwnerUser, setSession } from "@/lib/session";
import type { LoginSuccessResponse, MfaRequiredResponse, OwnerUser } from "@/types";

function normalizeCode(input: string) {
  return input.replace(/\D/g, "").slice(0, 6);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<OwnerUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMfaStep = Boolean(mfaToken && pendingUser);
  const verifyDisabled = loading || code.length !== 6;
  const submitLabel = useMemo(
    () => (loading ? (isMfaStep ? "Verifying..." : "Signing in...") : isMfaStep ? "Verify code" : "Sign in"),
    [isMfaStep, loading],
  );

  useEffect(() => {
    const token = getStoredToken();
    const user = getStoredUser();
    if (token && isOwnerUser(user)) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  async function handlePasswordLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post<LoginSuccessResponse | MfaRequiredResponse>("/auth/login", {
        email,
        password,
      });

      if ("token" in response) {
        if (!isOwnerUser(response.user)) {
          setError("This portal is available to OWNER accounts only.");
          return;
        }

        setSession(response.token, response.user);
        navigate("/dashboard", { replace: true });
        return;
      }

      if (!isOwnerUser(response.user)) {
        setError("This portal is available to OWNER accounts only.");
        return;
      }

      setPendingUser(response.user);
      setMfaToken(response.mfaToken);
      setCode("");
    } catch (error) {
      setError(getErrorMessage(error, "Unable to sign in right now."));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaToken) return;

    setLoading(true);
    setError("");

    try {
      const response = await api.post<LoginSuccessResponse>("/auth/mfa/login/verify", {
        mfaToken,
        code,
      });

      if (!isOwnerUser(response.user)) {
        setError("This portal is available to OWNER accounts only.");
        return;
      }

      setSession(response.token, response.user);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_MFA_CODE") {
        setError("Invalid authentication code. Try again.");
      } else {
        setError(getErrorMessage(error, "Unable to verify your authentication code."));
      }
    } finally {
      setLoading(false);
    }
  }

  function resetMfaStep() {
    setMfaToken(null);
    setPendingUser(null);
    setCode("");
    setError("");
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            {isMfaStep ? <KeyRound size={20} /> : <Shield size={20} />}
          </div>
          <p className="eyebrow">Frederick Recovery Factory</p>
          <h1>{isMfaStep ? "Enter authentication code" : "Owner access"}</h1>
          <p className="muted">
            {isMfaStep
              ? "Open your authenticator app and enter the 6-digit code."
              : "Sign in with your OWNER account to manage activation batches and security settings."}
          </p>
        </div>

        {pendingUser ? (
          <div className="inline-note">
            <span>Signing in as</span>
            <strong>{pendingUser.email}</strong>
          </div>
        ) : null}

        {error ? <div className="alert error">{error}</div> : null}

        {!isMfaStep ? (
          <form className="form-stack" onSubmit={handlePasswordLogin}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="owner@frederickrecovery.com"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>

            <button className="button primary" type="submit" disabled={loading}>
              {submitLabel}
            </button>
          </form>
        ) : (
          <form className="form-stack" onSubmit={handleMfaVerify}>
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

            <button className="button primary" type="submit" disabled={verifyDisabled}>
              {submitLabel}
            </button>
            <button className="button secondary" type="button" onClick={resetMfaStep} disabled={loading}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
