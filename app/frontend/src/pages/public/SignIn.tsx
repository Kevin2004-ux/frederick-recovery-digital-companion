import { Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildVerifyEmailRoute, resolveAfterSignIn, routes } from "@/lib/routes";
import type { LoginResponse } from "@/types/auth";

export function SignIn() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      const profile = await login(response.token, response.user);
      navigate(
        profile.role === "PATIENT" &&
          (!profile.consentAcceptedAt || !profile.procedureName || !profile.recoveryStartDate)
          ? routes.patientOnboarding
          : resolveAfterSignIn(profile),
      );
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      if (apiError.code === "EMAIL_NOT_VERIFIED") {
        navigate(buildVerifyEmailRoute(email));
      } else {
        setError(apiError.message || "Unable to sign in with those credentials.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="hero-panel hidden lg:block">
          <p className="eyebrow !text-brand-100">Frederick Recovery</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold tracking-[-0.04em] text-balance">
            A calmer, safer recovery workspace for patients and care teams.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-200">
            Keep daily recovery steps, symptom tracking, and clinic follow-up organized in one place
            without changing the current secure backend flow.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Protected access</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                Bearer-token auth and backend profile checks stay exactly as they are.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Patient-friendly</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                Large touch targets and clearer forms for low-energy recovery days.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/8 p-4">
              <p className="text-sm font-semibold text-white">Clinic-ready</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">
                The same onboarding, tracker, and clinic route contracts remain intact.
              </p>
            </div>
          </div>
        </section>

        <Card className="w-full max-w-xl justify-self-center">
          <p className="eyebrow">Secure sign in</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Use your Frederick Recovery account to continue in the patient or clinic workspace.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                className="field"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="field-label !mb-0" htmlFor="password">
                  Password
                </label>
                <Link className="text-sm font-medium text-brand-700 hover:text-brand-800" to={routes.forgotPassword}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="field pr-12"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute inset-y-0 right-4 text-slate-400 transition hover:text-slate-700"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <StatePanel description={error} title="Sign-in problem" tone="danger" />
            ) : null}

            <Button className="w-full justify-center" disabled={loading} type="submit">
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="soft-divider mt-7" />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-100"
              to={routes.activate}
            >
              <p className="text-sm font-semibold text-slate-900">Need a new patient account?</p>
              <p className="mt-1 text-sm leading-7 text-slate-600">Activate with a clinic code.</p>
            </Link>
            <Link
              className="rounded-[22px] border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-100"
              to={routes.root}
            >
              <p className="text-sm font-semibold text-slate-900">Back to overview</p>
              <p className="mt-1 text-sm leading-7 text-slate-600">Review the product overview first.</p>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
