import { MailCheck, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = useMemo(() => params.get("email") || "", [params]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api.post("/auth/verify", { email, code: code.trim() });
      setMessage("Email verified. You can sign in now.");
      window.setTimeout(() => navigate(routes.signIn), 1200);
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to verify that code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError("");
    setMessage("");
    try {
      const response = await api.post<{ message?: string }>("/auth/verify/resend", { email });
      setMessage(response.message || "Verification code resent.");
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to resend a code right now.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <Card className="w-full">
          <div className="inline-flex rounded-2xl bg-emerald-50 p-3 text-emerald-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="eyebrow mt-6">Verify email</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Confirm your email address
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Enter the verification code sent to <span className="font-medium text-slate-900">{email || "your email"}</span>.
          </p>

          <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            Verification stays on the current backend flow. Successful verification still sends you back to sign in.
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {!email ? (
              <StatePanel
                description="An email address is required in the URL before the current backend verification flow can continue."
                title="Missing verification email"
                tone="warning"
              />
            ) : null}

            <div>
              <label className="field-label" htmlFor="verify-code">
                Verification code
              </label>
              <input
                className="field tracking-[0.18em]"
                id="verify-code"
                onChange={(event) => setCode(event.target.value)}
                required
                value={code}
              />
            </div>

            {error ? <StatePanel description={error} title="Verification issue" tone="danger" /> : null}
            {message ? <StatePanel description={message} title="Verification updated" tone="success" /> : null}

            <Button className="w-full justify-center" disabled={!email || loading} type="submit">
              {loading ? "Verifying..." : "Verify email"}
            </Button>
          </form>

          <div className="soft-divider mt-7" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="justify-center" disabled={!email || resending} onClick={handleResend} variant="secondary">
              <RotateCcw className="h-4 w-4" />
              {resending ? "Resending..." : "Resend code"}
            </Button>
            <Link className="button-ghost" to={routes.signIn}>
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
