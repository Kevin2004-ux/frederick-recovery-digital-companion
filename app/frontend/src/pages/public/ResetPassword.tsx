import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post<{ message?: string }>("/auth/reset-password", {
        token,
        password,
      });
      setMessage(response.message || "Password updated successfully.");
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to reset the password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <Card className="w-full">
          <div className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="eyebrow mt-6">Reset password</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Choose a new password
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The backend requires a secure password and invalidates old sessions after a successful reset.
          </p>

          {!token ? (
            <StatePanel
              className="mt-8"
              description="A reset token is required in the URL before the current backend reset flow can continue."
              title="Missing reset token"
              tone="warning"
            />
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="field-label" htmlFor="new-password">
                New password
              </label>
              <input
                className="field"
                id="new-password"
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            {error ? <StatePanel description={error} title="Reset issue" tone="danger" /> : null}
            {message ? <StatePanel description={message} title="Password updated" tone="success" /> : null}

            <Button className="w-full justify-center" disabled={!token || loading} type="submit">
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>

          <div className="soft-divider mt-7" />
          <Link className="button-ghost mt-6" to={routes.signIn}>
            Return to sign in
          </Link>
        </Card>
      </div>
    </main>
  );
}
