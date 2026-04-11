import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CircleCheckBig,
  Package,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { calculateTrophySummary } from "@/features/trophies/trophyEngine";
import { dayDifferenceFromStart, formatDateYmd, formatDisplayDate, getTodayYmd } from "@/lib/date";
import { routes } from "@/lib/routes";
import type { RecoveryLogEntry } from "@/types/log";

interface PlanDayModule {
  id?: string;
  title?: string;
  body?: string;
}

interface PlanDay {
  dayIndex: number;
  phase?: string;
  modulesResolved?: PlanDayModule[];
}

interface CurrentPlanResponse {
  id: string;
  startDate: string;
  planJson?: {
    days?: PlanDay[];
  };
}

interface MyBoxResponse {
  myBox: {
    batchId: string;
    boxType: string | null;
    includedItems: Array<{ key: string; label: string }>;
  } | null;
}

export function PatientHome() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<RecoveryLogEntry[]>([]);
  const [plan, setPlan] = useState<CurrentPlanResponse | null>(null);
  const [myBox, setMyBox] = useState<MyBoxResponse["myBox"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const today = getTodayYmd();
      const from = formatDateYmd(new Date(new Date(`${today}T00:00:00`).getTime() - 6 * 86400000));

      const [entriesResponse, planResponse, myBoxResponse] = await Promise.allSettled([
        api.get<RecoveryLogEntry[]>(`/log/entries?from=${from}&to=${today}`),
        api.get<CurrentPlanResponse>("/plan/today/resolved"),
        api.get<MyBoxResponse>("/activation/my-box"),
      ]);

      if (!active) {
        return;
      }

      if (entriesResponse.status === "fulfilled") {
        setEntries(entriesResponse.value);
      }
      if (planResponse.status === "fulfilled") {
        setPlan(planResponse.value);
      } else {
        setPlan(null);
      }
      if (myBoxResponse.status === "fulfilled") {
        setMyBox(myBoxResponse.value.myBox);
      }

      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const todayEntry = entries.find((entry) => entry.date === getTodayYmd()) || null;
  const trophySummary = useMemo(() => calculateTrophySummary(entries), [entries]);
  const todayPlan = useMemo(() => {
    const currentDay = dayDifferenceFromStart(plan?.startDate || user?.recoveryStartDate);
    if (!plan?.planJson?.days || currentDay === null) {
      return null;
    }
    return plan.planJson.days.find((day) => day.dayIndex === currentDay - 1) || null;
  }, [plan, user?.recoveryStartDate]);

  return (
    <main className="bg-app pb-28">
      <div className="app-shell">
        <PageIntro
          actions={
            <Link className="button-secondary" to={routes.patientTracker}>
              Open tracker
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
          description={`Recovery day ${dayDifferenceFromStart(user?.recoveryStartDate) || "?"} since ${formatDisplayDate(user?.recoveryStartDate)}.`}
          eyebrow="Patient home"
          title={`Welcome back, ${user?.email}`}
        />

        <section className="hero-panel">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="eyebrow !text-brand-100">Today at a glance</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
                Your recovery snapshot is organized and ready.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-200 sm:text-base">
                This home view keeps the current backend-connected functionality but makes the day&apos;s
                essentials easier to scan quickly: your progress, next plan focus, recent activity, and
                faster paths into the tracker, My Box, and Medical Hub.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link className="button-secondary border-white/15 bg-white/10 text-white hover:bg-white/15" to={routes.patientTracker}>
                  Log how you feel
                </Link>
                <Link className="button-secondary border-white/15 bg-white/10 text-white hover:bg-white/15" to={routes.patientMedicalHub}>
                  Open Medical Hub
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <p className="text-sm text-slate-200">Today&apos;s check-in</p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {todayEntry ? `${todayEntry.painLevel}/10` : "Pending"}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-200">
                  {todayEntry ? "Pain level captured today." : "No daily check-in saved yet."}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <p className="text-sm text-slate-200">Current streak</p>
                <p className="mt-2 text-3xl font-semibold text-white">{trophySummary.currentStreak} days</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">{trophySummary.consistencyLabel}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                <p className="text-sm text-slate-200">My Box items</p>
                <p className="mt-2 text-3xl font-semibold text-white">{myBox?.includedItems.length || 0}</p>
                <p className="mt-2 text-sm leading-7 text-slate-200">{myBox?.boxType || "No linked box yet"}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Next recovery focus</h2>
                <p className="section-subtitle">
                  Pulled from the current plan endpoint without changing backend plan generation.
                </p>
              </div>
              {todayPlan ? <Badge tone="info">Day {todayPlan.dayIndex + 1}</Badge> : null}
            </div>

            {loading ? (
              <StatePanel
                className="mt-6"
                description="Loading home details from your current plan, recent log entries, and box metadata."
                title="Loading recovery details"
              />
            ) : null}

            {!loading && todayPlan?.modulesResolved?.length ? (
              <div className="mt-6 grid gap-3">
                {todayPlan.modulesResolved.slice(0, 3).map((module, index) => (
                  <div
                    className="rounded-[26px] border border-slate-100 bg-slate-50/75 px-4 py-4"
                    key={`${module.title || "module"}-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                        <CircleCheckBig className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{module.title || "Recovery step"}</p>
                        <p className="mt-1 text-sm leading-7 text-slate-600">
                          {module.body || "No additional detail provided for this module."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && !todayPlan?.modulesResolved?.length ? (
              <StatePanel
                className="mt-6"
                description="No resolved plan day is available yet. Your clinic may still be approving or generating the plan."
                title="Plan not ready"
                tone="warning"
              />
            ) : null}
          </Card>

          <div className="grid gap-5">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="section-title">Recovery profile</h2>
                  <p className="section-subtitle">Keep your procedure details accurate.</p>
                </div>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Procedure</dt>
                  <dd className="font-medium text-slate-900">{user?.procedureName || "Not set"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Recovery start</dt>
                  <dd className="font-medium text-slate-900">{formatDisplayDate(user?.recoveryStartDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Consent</dt>
                  <dd className="font-medium text-slate-900">{user?.consentAcceptedAt ? "Accepted" : "Required"}</dd>
                </div>
              </dl>
              <Link className="button-secondary mt-5" to={routes.patientProfile}>
                Update profile
              </Link>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <Package className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="section-title">Recovery kit</h2>
                  <p className="section-subtitle">Review linked box items and education.</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {myBox?.includedItems.length
                  ? `${myBox.includedItems.length} item(s) are linked to your claimed activation batch.`
                  : "Your activation batch has not linked any box items yet."}
              </p>
              <Link className="button-secondary mt-5" to={routes.patientMyBox}>
                Open My Box
              </Link>
            </Card>

            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="section-title">Medical Hub</h2>
                  <p className="section-subtitle">Medication lookup plus recovery education.</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Search openFDA medication labels and MedlinePlus recovery topics directly from the frontend.
              </p>
              <Link className="button-secondary mt-5" to={routes.patientMedicalHub}>
                Explore the hub
              </Link>
            </Card>
          </div>
        </div>

        <Card className="mt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Recent check-ins</h2>
                <p className="section-subtitle">
                  Your last seven saved entries, straight from `/log/entries`.
                </p>
              </div>
            </div>
            <div className="hidden rounded-[24px] bg-slate-50 px-4 py-3 text-right sm:block">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Momentum</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {trophySummary.longestStreak} day longest streak
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {entries.length ? (
              entries
                .slice()
                .reverse()
                .map((entry) => (
                  <div className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4" key={entry.date}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{entry.date}</p>
                      <div className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
                        Pain {entry.painLevel}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Pain {entry.painLevel}/10 • Swelling {entry.swellingLevel}/10
                    </p>
                    <p className="mt-2 text-xs leading-6 text-slate-500">
                      {entry.notes || "No notes added."}
                    </p>
                  </div>
                ))
            ) : (
              <StatePanel
                className="sm:col-span-2 xl:col-span-3"
                description="No check-ins yet. Start with the tracker to build your recovery timeline."
                title="Recovery log is empty"
              />
            )}
          </div>
        </Card>
      </div>

      <PatientBottomNav />
    </main>
  );
}
