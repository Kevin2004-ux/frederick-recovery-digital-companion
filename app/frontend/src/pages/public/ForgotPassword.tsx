import { LifeBuoy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post<{ message?: string }>("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      setMessage(response.message || "If that account exists, a reset email has been sent.");
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to start the reset flow.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <Card className="w-full">
          <div className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-700">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <p className="eyebrow mt-6">Password support</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            We will trigger the existing backend reset flow without exposing whether an email exists.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="field-label" htmlFor="reset-email">
                Account email
              </label>
              <input
                className="field"
                id="reset-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>

            {error ? <StatePanel description={error} title="Reset request issue" tone="danger" /> : null}
            {message ? <StatePanel description={message} title="Reset email sent" tone="success" /> : null}

            <Button className="w-full justify-center" disabled={loading} type="submit">
              {loading ? "Sending..." : "Send reset email"}
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
