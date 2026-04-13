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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyLogEntry, MyBoxPayload, PatientProfile } from "@/types";

const FUTURE_PORTAL_ROUTES = {
  tracker: "/log",
  myBox: "/my-box",
  medicalHub: "/medical-hub",
  resources: "/resources",
} as const;

const NAV_ITEMS = [
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
    subtitle: "See what came with your recovery kit.",
    icon: Package2,
    href: FUTURE_PORTAL_ROUTES.myBox,
  },
  {
    key: "medical-hub",
    title: "Medical Hub",
    subtitle: "Look up medications and recovery guidance.",
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

function firstNameFromProfile(profile: PatientProfile | null) {
  const rawName = profile?.displayName?.trim();
  if (!rawName) return null;

  return rawName.split(/\s+/)[0] ?? null;
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

  useEffect(() => {
    let active = true;

    async function loadHomeSummary() {
      const [profileResult, entriesResult, boxResult] = await Promise.allSettled([
        api<PatientProfile>("/user/profile", { method: "GET" }),
        api<DailyLogEntry[]>("/log/entries", { method: "GET" }),
        api<MyBoxPayload>("/activation/my-box", { method: "GET" }),
      ]);

      if (!active) return;

      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);
      setEntries(entriesResult.status === "fulfilled" ? entriesResult.value : []);
      setBoxData(boxResult.status === "fulfilled" ? boxResult.value : null);
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
  const procedureName = profile?.procedureName?.trim() || null;

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto w-full space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
              Frederick Recovery
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Patient portal
            </h1>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            {procedureName
              ? `Your ${procedureName} recovery details, tools, and next steps are all in one calm place.`
              : "Keep your recovery details, care tools, and next steps in one calm place."}
          </p>
        </div>
      </header>

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
                    : "Stay on track with daily check-ins, care information, and the tools you need for recovery."}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
              <ShieldCheck className="h-5 w-5" />
              {hasTodayEntry ? "Checked in today" : "Ready for today"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] bg-stone-50/90 p-4">
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

            <div className="rounded-[24px] bg-stone-50/90 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                Today
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {hasTodayEntry ? "Check-in saved" : "Check-in pending"}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {hasTodayEntry
                  ? "You’ve already logged today’s recovery update."
                  : "Open My Tracker when you’re ready to log today’s recovery."}
              </p>
            </div>

            <div className="rounded-[24px] bg-stone-50/90 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/75">
                Recovery box
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {boxData?.myBox ? boxType : "Not assigned"}
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {boxData?.myBox
                  ? "Review supplies and item guidance from your current kit."
                  : "Your recovery box details will appear here when available."}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {NAV_ITEMS.map((item) => {
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
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
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

                <div className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  <span>Open</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}
