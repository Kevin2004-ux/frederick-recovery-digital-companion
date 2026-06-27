import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenText,
  HeartPulse,
  LogOut,
  Package2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { api } from "@/api/client";
import { clearToken } from "@/auth/token";
import { QuickCheckIn, type QuickCheckInState } from "@/components/log/QuickCheckIn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  DailyLogEntry,
  MyBoxPayload,
  PatientProfile,
  RecoveryLibraryHomePayload,
} from "@/types";

const FUTURE_PORTAL_ROUTES = {
  tracker: "/log",
  myBox: "/medical-hub?tab=kit",
  procedure: "/medical-hub?tab=procedure",
  medicalHub: "/medical-hub?tab=library",
  resources: "/resources",
} as const;

const FULL_PLATFORM_NAV_ITEMS = [
  {
    key: "tracker",
    title: "My Tracker",
    subtitle: "Check in and review your recovery days.",
    icon: HeartPulse,
    href: FUTURE_PORTAL_ROUTES.tracker,
  },
  {
    key: "my-box",
    title: "My Box",
    subtitle: "See the instructions for your recovery kit.",
    icon: Package2,
    href: FUTURE_PORTAL_ROUTES.myBox,
  },
  {
    key: "medical-hub",
    title: "Recovery Library",
    subtitle: "Browse visual guides, box item instructions, and recovery videos.",
    icon: Stethoscope,
    href: FUTURE_PORTAL_ROUTES.medicalHub,
  },
  {
    key: "resources",
    title: "Resources",
    subtitle: "Helpful information and support links.",
    icon: BookOpenText,
    href: FUTURE_PORTAL_ROUTES.resources,
  },
] as const;

const KIT_ONLY_NAV_ITEMS = [
  {
    key: "procedure",
    title: "Procedure Guide",
    subtitle: "Open the recovery education assigned by your clinic.",
    icon: Stethoscope,
    href: FUTURE_PORTAL_ROUTES.procedure,
  },
  {
    key: "my-box",
    title: "Box Instructions",
    subtitle: "Review item notes and guides for your physical recovery kit.",
    icon: Package2,
    href: FUTURE_PORTAL_ROUTES.myBox,
  },
  {
    key: "medical-hub",
    title: "Full Library",
    subtitle: "Browse Frederick Recovery education by topic.",
    icon: BookOpenText,
    href: FUTURE_PORTAL_ROUTES.medicalHub,
  },
  {
    key: "resources",
    title: "Resources",
    subtitle: "Helpful information and support links.",
    icon: ShieldCheck,
    href: FUTURE_PORTAL_ROUTES.resources,
  },
] as const;

type PatientProfileResponse = PatientProfile | { profile: PatientProfile };

function firstNameFromProfile(profile: PatientProfile | null) {
  const rawName = profile?.displayName?.trim();
  if (!rawName) return null;

  return rawName.split(/\s+/)[0] ?? null;
}

function unwrapPatientProfile(payload: PatientProfileResponse | null): PatientProfile | null {
  if (!payload) return null;
  if ("profile" in payload) return payload.profile;
  return payload;
}

function todayLocalYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDateYYYYMMDD(s: string): Date | null {
  const [year, month, day] = s.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function deriveRecoveryDay(dateString?: string | null) {
  if (!dateString) return null;

  const start = parseLocalDateYYYYMMDD(dateString);
  if (!start) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - start.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return null;

  return Math.floor(diffMs / 86400000) + 1;
}

export default function PatientHome() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [entries, setEntries] = useState<DailyLogEntry[]>([]);
  const [boxData, setBoxData] = useState<MyBoxPayload | null>(null);
  const [libraryHome, setLibraryHome] = useState<RecoveryLibraryHomePayload | null>(null);
  const [quickCheckInDismissed, setQuickCheckInDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHomeSummary() {
      const [profileResult, boxResult, libraryResult] = await Promise.allSettled([
        api<PatientProfileResponse>("/user/profile", { method: "GET" }),
        api<MyBoxPayload>("/activation/my-box", { method: "GET" }),
        api<RecoveryLibraryHomePayload>("/education/library", { method: "GET" }),
      ]);

      if (!active) return;

      const nextProfile =
        profileResult.status === "fulfilled"
          ? unwrapPatientProfile(profileResult.value)
          : null;
      const nextLibrary =
        libraryResult.status === "fulfilled" ? libraryResult.value : null;
      const productMode = nextLibrary?.personalized.productMode ?? "full_platform";

      setProfile(nextProfile);
      setBoxData(boxResult.status === "fulfilled" ? boxResult.value : null);
      setLibraryHome(nextLibrary);

      if (productMode === "kit_only") {
        setEntries([]);
        return;
      }

      const entriesResult = await api<DailyLogEntry[]>("/log/entries", { method: "GET" })
        .then((value) => ({ status: "fulfilled" as const, value }))
        .catch(() => ({ status: "rejected" as const, value: [] as DailyLogEntry[] }));

      if (!active) return;
      setEntries(entriesResult.status === "fulfilled" ? entriesResult.value : []);
    }

    void loadHomeSummary();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => firstNameFromProfile(profile), [profile]);
  const today = useMemo(() => todayLocalYYYYMMDD(), []);
  const hasTodayEntry = useMemo(
    () => entries.some((entry) => entry.date === today),
    [entries, today]
  );
  const recoveryDay = useMemo(
    () => deriveRecoveryDay(profile?.recoveryStartDate),
    [profile?.recoveryStartDate]
  );
  const boxType = useMemo(
    () => boxData?.myBox?.boxType?.trim() || "Recovery kit",
    [boxData?.myBox?.boxType]
  );
  const productMode = libraryHome?.personalized.productMode ?? "full_platform";
  const isKitOnly = productMode === "kit_only";
  const procedureName =
    libraryHome?.personalized.procedureName?.trim() ||
    profile?.procedureName?.trim() ||
    null;
  const navItems = isKitOnly ? KIT_ONLY_NAV_ITEMS : FULL_PLATFORM_NAV_ITEMS;

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  async function onQuickLog(state: QuickCheckInState) {
    navigate("/log", { state: { quickCheckIn: state } });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
              Frederick Recovery
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Patient portal
            </h1>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-900"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {isKitOnly
              ? "Welcome to Your Recovery"
              : firstName
                ? `Welcome back, ${firstName}`
                : "Welcome back"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {isKitOnly
              ? "Your clinic has assigned a digital recovery guide and box instructions for your kit."
              : procedureName
              ? `Your ${procedureName} recovery details, tools, and next steps are all in one calm place.`
              : "Keep your recovery details, care tools, and next steps in one calm place."}
          </p>
        </div>
      </header>

      {isKitOnly ? (
        <section className="space-y-4">
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">
                    Education companion
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Your assigned guides and kit instructions are ready when you need them.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                <ShieldCheck className="h-5 w-5" />
                Kit-only guide
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:gap-4">
              <button
                type="button"
                onClick={() => navigate("/medical-hub?tab=procedure")}
                className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4 text-left transition-colors hover:bg-emerald-50"
              >
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  Procedure
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {procedureName || "Procedure guide"}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  View the education assigned for your recovery.
                </p>
              </button>

              <button
                type="button"
                onClick={() => navigate("/medical-hub?tab=kit")}
                className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4 text-left transition-colors hover:bg-emerald-50"
              >
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  My Kit
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {boxData?.myBox ? boxType : "Box instructions"}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Review item notes and physical box instructions.
                </p>
              </button>

              <button
                type="button"
                onClick={() => navigate("/medical-hub?tab=library")}
                className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4 text-left transition-colors hover:bg-emerald-50"
              >
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  Library
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  Browse Full Library
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Search and browse general recovery education.
                </p>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={() => navigate("/medical-hub?tab=procedure")}>
                View Procedure Guide
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/medical-hub?tab=kit")}
              >
                View Box Instructions
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/medical-hub?tab=library")}
              >
                Browse Full Library
              </Button>
            </div>
          </Card>
        </section>
      ) : (
        <section className="space-y-4">
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">
                    Recovery portal
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {hasTodayEntry
                      ? "Today’s check-in is already in place. You can review the rest of your recovery details below."
                      : "Stay on track with check-ins, care information, and the tools you need for recovery."}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                <ShieldCheck className="h-5 w-5" />
                {hasTodayEntry ? "Checked in today" : "Ready for today"}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:gap-4">
              <div className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  Recovery day
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {recoveryDay ? `Day ${recoveryDay}` : "Not set"}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {procedureName ? procedureName : "Add your procedure details anytime from onboarding."}
                </p>
              </div>

              <div className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  Today
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {hasTodayEntry ? "Check-in saved" : "Check-in pending"}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {hasTodayEntry
                    ? "You’ve already logged today’s recovery update."
                    : "Open My Tracker when you’re ready to complete today’s check-in."}
                </p>
              </div>

              <div className="rounded-[24px] border border-emerald-100/70 bg-emerald-50/50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                  My Box
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                  {boxData?.myBox ? boxType : "Not assigned"}
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {boxData?.myBox
                    ? "Review supplies and item guidance from your current kit."
                    : "Your box details will appear here when available."}
                </p>
              </div>
            </div>
          </Card>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.href)}
              className={cn(
                "group text-left",
                "rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition-all sm:p-6",
                "hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_38px_rgba(15,23,42,0.07)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
              )}
            >
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 transition-colors group-hover:text-emerald-900">
                  <span>Open</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {!isKitOnly && !hasTodayEntry && !quickCheckInDismissed ? (
        <div className="sticky bottom-4 z-10 pt-2">
          <QuickCheckIn
            onQuickLog={onQuickLog}
            onGoToFullLog={() => navigate("/log")}
            onDismiss={() => setQuickCheckInDismissed(true)}
            className="mx-auto max-w-4xl shadow-[0_20px_48px_rgba(15,23,42,0.12)]"
          />
        </div>
      ) : null}
    </div>
  );
}
