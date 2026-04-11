import { ArrowRight, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "@/components/auth/AuthProvider";
import { Card } from "@/components/ui/Card";
import { resolveAfterSignIn, routes } from "@/lib/routes";

export function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate replace to={resolveAfterSignIn(user)} />;
  }

  return (
    <main className="bg-app">
      <div className="app-shell pt-10">
        <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <section className="hero-panel">
            <p className="eyebrow !text-brand-100">Frederick Recovery</p>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Recovery guidance that feels calm, clear, and close at hand.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">
              Patients get a secure daily companion for symptoms, recovery education, and kit guidance.
              Clinic teams get protected activation, patient summaries, and follow-up support with the
              current backend still fully in charge.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="button-primary" to={routes.signIn}>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="button-secondary border-white/20 bg-white/10 text-white hover:bg-white/15"
                to={routes.activate}
              >
                Activate account
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <ShieldCheck className="h-5 w-5 text-brand-100" />
                <p className="mt-3 text-sm font-semibold text-white">Protected access</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  Bearer-token sign-in, onboarding guards, and clinic protection remain intact.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <HeartPulse className="h-5 w-5 text-brand-100" />
                <p className="mt-3 text-sm font-semibold text-white">Patient-friendly</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  Large touch targets and clearer guidance for low-energy recovery days.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <Stethoscope className="h-5 w-5 text-brand-100" />
                <p className="mt-3 text-sm font-semibold text-white">Clinic-ready</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  Batch codes, patient detail, and exports still flow through the current backend.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-5">
            <Card>
              <p className="eyebrow">What stays the same</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                No backend or auth redesign needed.
              </h2>
              <div className="mt-6 grid gap-3">
                <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  Sign in, verify email, forgot password, reset password, onboarding, tracker saves, and
                  clinic route behavior all preserve their current contracts.
                </div>
                <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                  My Box and Medical Hub remain available without backend redesign, including direct public
                  lookups where already intended.
                </div>
              </div>
            </Card>

            <Card>
              <p className="eyebrow">Quick paths</p>
              <div className="mt-5 grid gap-3">
                <Link className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100" to={routes.signIn}>
                  <p className="text-sm font-semibold text-slate-900">Returning user</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">Go straight to secure sign in.</p>
                </Link>
                <Link className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100" to={routes.activate}>
                  <p className="text-sm font-semibold text-slate-900">New patient activation</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">Create an account with your clinic code.</p>
                </Link>
                <Link className="rounded-[24px] border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100" to={routes.forgotPassword}>
                  <p className="text-sm font-semibold text-slate-900">Password help</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">Start the current reset flow if you are locked out.</p>
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
