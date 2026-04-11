import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildVerifyEmailRoute, routes } from "@/lib/routes";

export function Activate() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleActivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/activation/claim", {
        code: code.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
      });
      navigate(buildVerifyEmailRoute(email));
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to activate this code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-8 lg:grid-cols-[1fr_1fr] lg:px-8">
        <section className="hero-panel hidden lg:block">
          <p className="eyebrow !text-brand-100">Patient activation</p>
          <h1 className="mt-4 max-w-xl text-5xl font-semibold tracking-[-0.04em] text-balance">
            Create a patient account without changing the current activation flow.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-200">
            This screen still uses the existing backend `POST /activation/claim` contract. We&apos;re only
            making the experience calmer, clearer, and easier to finish.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm font-semibold text-white">Step 1</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">Add your email and a password that meets backend rules.</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
              <p className="text-sm font-semibold text-white">Step 2</p>
              <p className="mt-2 text-sm leading-7 text-slate-200">Enter the clinic activation code and continue to email verification.</p>
            </div>
          </div>
        </section>

        <Card className="w-full max-w-xl justify-self-center">
          <p className="eyebrow">Create patient account</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
            Activate your access
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Start with your email and password, then enter the activation code provided by your clinic.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1">
            <div className={`rounded-full px-3 py-2 text-center text-sm font-medium ${step === 1 ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
              Account
            </div>
            <div className={`rounded-full px-3 py-2 text-center text-sm font-medium ${step === 2 ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
              Activation
            </div>
          </div>

          {step === 1 ? (
            <form
              className="mt-8 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!email || password.length < 12) {
                  setError("Enter a valid email and a password with at least 12 characters.");
                  return;
                }
                setError("");
                setStep(2);
              }}
            >
              <div>
                <label className="field-label" htmlFor="activate-email">
                  Email
                </label>
                <input
                  className="field"
                  id="activate-email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="activate-password">
                  Password
                </label>
                <input
                  className="field"
                  id="activate-password"
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <p className="mt-2 text-xs text-slate-500">
                  The backend requires a password that is at least 12 characters long.
                </p>
              </div>

              {error ? <StatePanel description={error} title="Account setup issue" tone="danger" /> : null}

              <Button className="w-full justify-center" type="submit">
                <ShieldCheck className="h-4 w-4" />
                Continue
              </Button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleActivate}>
              <div>
                <label className="field-label" htmlFor="activation-code">
                  Activation code
                </label>
                <input
                  className="field uppercase tracking-[0.2em]"
                  id="activation-code"
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="FR-XXXX-XXXX"
                  required
                  value={code}
                />
                <p className="mt-2 text-xs text-slate-500">
                  This code is supplied by your clinic and matched against the locked backend activation routes.
                </p>
              </div>

              {error ? <StatePanel description={error} title="Activation issue" tone="danger" /> : null}

              <div className="flex flex-wrap gap-3">
                <Button className="flex-1 justify-center" disabled={loading} type="submit">
                  <KeyRound className="h-4 w-4" />
                  {loading ? "Activating..." : "Create account"}
                </Button>
                <Button className="flex-1 justify-center" onClick={() => setStep(1)} type="button" variant="secondary">
                  Back
                </Button>
              </div>
            </form>
          )}

          <div className="soft-divider mt-7" />
          <div className="mt-6 text-sm text-slate-600">
            Already activated?{" "}
            <Link className="font-medium text-brand-700 hover:text-brand-800" to={routes.signIn}>
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
