import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { clearToken } from "@/auth/token";

import DailyCheckInForm, {
  type DailyCheckInFormInitial,
  type DailyCheckInFormPayload,
  type RedFlagKey,
} from "@/components/log/DailyCheckInForm";
import { QuickCheckIn, type QuickCheckInState } from "@/components/log/QuickCheckIn";
import { WeekLogPicker } from "@/components/log/WeekLogPicker";
import { DayEntrySummary } from "@/components/log/DayEntrySummary";
import {
  buildClinicianReportHtml,
  downloadPdfReport,
} from "@/components/log/reportExport";

import { Button } from "@/components/ui/button";

import { Download, Eye, House } from "lucide-react";

type LogEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  schemaVersion: number;
  details?: Record<string, unknown>;
};

type Profile = {
  procedureName: string;
  recoveryStartDate: string;
};

function todayLocalYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDateYYYYMMDD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function formatLongDate(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parseLocalDateYYYYMMDD(dateStr));
}

function isWithinLastNDays(dateStr: string, n: number): boolean {
  const dt = parseLocalDateYYYYMMDD(dateStr);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const min = new Date(today);
  min.setDate(min.getDate() - (n - 1));

  return dt >= min && dt <= today;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function mapRedFlags(value: unknown): RedFlagKey[] {
  if (!Array.isArray(value)) return [];

  const mapped = value.flatMap((item) => {
    const normalized = normalizeText(item);

    if (!normalized || normalized === "none") return [];
    if (normalized === "fever_over_101" || normalized === "fever") {
      return ["fever_over_101" as const];
    }
    if (
      normalized === "pain_getting_worse" ||
      normalized === "sudden worsening" ||
      normalized === "severe swelling/pain"
    ) {
      return ["pain_getting_worse" as const];
    }
    if (normalized === "redness_spreading") {
      return ["redness_spreading" as const];
    }
    if (
      normalized === "chest_pain_breathing" ||
      normalized === "chest pain" ||
      normalized === "shortness of breath"
    ) {
      return ["chest_pain_breathing" as const];
    }

    return [];
  });

  return Array.from(new Set(mapped));
}

function mapMedicationStatus(details: Record<string, unknown>) {
  const medicationStatus = normalizeText(details.medicationStatus);
  if (medicationStatus === "missed_dose" || medicationStatus === "took_it") {
    return medicationStatus;
  }

  const tookMeds = normalizeText(details.tookMeds);
  if (tookMeds === "yes") return "took_it";
  if (tookMeds === "missed one" || tookMeds === "missed multiple") {
    return "missed_dose";
  }

  return "took_it";
}

function mapSideEffectsOrConcerns(details: Record<string, unknown>) {
  if (typeof details.sideEffectsOrConcerns === "string") {
    return details.sideEffectsOrConcerns.trim();
  }

  if (typeof details.sideEffectsOtherText === "string") {
    return details.sideEffectsOtherText.trim();
  }

  if (Array.isArray(details.sideEffects)) {
    const values = details.sideEffects
      .filter((item): item is string => typeof item === "string")
      .filter((item) => item !== "None" && item !== "Other");

    return values.join(", ").trim();
  }

  return "";
}

function mapDrainage(details: Record<string, unknown>) {
  const drainage = normalizeText(details.drainage);
  if (
    drainage === "none" ||
    drainage === "light" ||
    drainage === "moderate" ||
    drainage === "heavy"
  ) {
    return drainage;
  }
  if (drainage === "clear") return "light";
  if (drainage === "bloody" || drainage === "yellow-green") return "moderate";
  return undefined;
}

function mapRedness(details: Record<string, unknown>) {
  const redness = normalizeText(details.rednessAroundIncision);
  if (
    redness === "none" ||
    redness === "mild" ||
    redness === "moderate" ||
    redness === "severe"
  ) {
    return redness;
  }

  const siteChange = normalizeText(details.siteChange);
  if (siteChange === "no" || siteChange === "stable") return "none";
  if (siteChange === "slight" || siteChange === "sore") return "mild";
  if (siteChange === "significant" || siteChange === "changed") return "severe";

  return undefined;
}

function mapYesNo(value: unknown) {
  const normalized = normalizeText(value);
  if (normalized === "yes" || normalized === "no") return normalized;
  return undefined;
}

function mapMobility(details: Record<string, unknown>) {
  const mobility = normalizeText(details.mobility);
  if (mobility === "normal" || mobility === "limited" || mobility === "bedrest") {
    return mobility;
  }
  if (mobility === "easy") return "normal";
  if (mobility === "manageable") return "limited";

  const moved = normalizeText(details.movedAsRecommended);
  const activities = normalizeText(details.difficultyActivities);

  if (moved === "no" || activities === "significant") return "bedrest";
  if (moved === "somewhat" || activities === "mild") return "limited";
  if (moved === "yes" || activities === "none") return "normal";

  return undefined;
}

function initialForEntry(entry: LogEntry): DailyCheckInFormInitial {
  const details = isRecord(entry.details) ? entry.details : {};
  const medicationStatus = mapMedicationStatus(details);
  const sideEffectsOrConcerns = mapSideEffectsOrConcerns(details);

  return {
    painLevel: entry.painLevel,
    swellingLevel: entry.swellingLevel,
    notes: entry.notes ?? "",
    details: {
      medicationStatus,
      redFlags: mapRedFlags(details.redFlags),
      sideEffectsOrConcerns:
        medicationStatus === "missed_dose" && sideEffectsOrConcerns
          ? sideEffectsOrConcerns
          : undefined,
      drainage: mapDrainage(details),
      rednessAroundIncision: mapRedness(details),
      warmthAroundWound: mapYesNo(details.warmthAroundWound),
      unusualOdor: mapYesNo(details.unusualOdor),
      mobility: mapMobility(details),
    },
  };
}

function quickPrefillForState(state: QuickCheckInState): DailyCheckInFormInitial {
  if (state === "good") {
    return {
      painLevel: 2,
      swellingLevel: 2,
      details: { medicationStatus: "took_it" },
    };
  }

  if (state === "poor") {
    return {
      painLevel: 7,
      swellingLevel: 7,
      details: { medicationStatus: "took_it" },
    };
  }

  return {
    painLevel: 4,
    swellingLevel: 4,
    details: { medicationStatus: "took_it" },
  };
}

export default function RecoveryLog() {
  const navigate = useNavigate();
  const today = todayLocalYYYYMMDD();

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocalYYYYMMDD());

  const [activeFormDate, setActiveFormDate] = useState<string | null>(null);
  const [activeFormMode, setActiveFormMode] = useState<"create" | "edit">(
    "create"
  );
  const [activeFormInitial, setActiveFormInitial] = useState<
    DailyCheckInFormInitial | undefined
  >(undefined);

  const [todayQuickPrefill, setTodayQuickPrefill] = useState<
    DailyCheckInFormInitial | undefined
  >(undefined);
  const [todayQuickLoadingState, setTodayQuickLoadingState] =
    useState<QuickCheckInState | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const todayEntry = useMemo(
    () => entries.find((e) => e.date === today) ?? null,
    [entries, today]
  );

  async function loadEntries(): Promise<LogEntry[]> {
    setLoadingList(true);
    try {
      const data = await api<LogEntry[]>("/log/entries", { method: "GET" });
      const sorted = [...data].sort((a, b) => (a.date < b.date ? 1 : -1));
      setEntries(sorted);
      return sorted;
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  useEffect(() => {
    api<Profile>("/user/profile", { method: "GET" })
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!todayEntry) return;

    if (activeFormDate === today) {
      setActiveFormDate(null);
    }

    setTodayQuickPrefill(undefined);
    setTodayQuickLoadingState(null);
  }, [activeFormDate, today, todayEntry]);

  async function saveEntryForDate(
    targetDate: string,
    mode: "create" | "edit",
    payload: DailyCheckInFormPayload
  ) {
    if (mode === "edit") {
      await api<LogEntry>(`/log/entries/${encodeURIComponent(targetDate)}`, {
        method: "PUT",
        json: {
          painLevel: payload.painLevel,
          swellingLevel: payload.swellingLevel,
          notes: payload.notes,
          details: payload.details,
        },
      });
    } else {
      await api<LogEntry>("/log/entries", {
        method: "POST",
        json: {
          date: targetDate,
          painLevel: payload.painLevel,
          swellingLevel: payload.swellingLevel,
          notes: payload.notes,
          schemaVersion: 2,
          details: payload.details,
        },
      });
    }

    await loadEntries();
  }

  function openFormForDate(targetDate: string, initialOverride?: DailyCheckInFormInitial) {
    const existing = entries.find((entry) => entry.date === targetDate) ?? null;

    setActiveFormDate(targetDate);
    setActiveFormMode(existing ? "edit" : "create");
    setActiveFormInitial(initialOverride ?? (existing ? initialForEntry(existing) : undefined));
  }

  function closeActiveForm() {
    const wasTodayCreate = activeFormDate === today && !todayEntry;
    setActiveFormDate(null);
    setActiveFormInitial(undefined);
    if (wasTodayCreate) {
      setTodayQuickPrefill(undefined);
    }
    if (activeFormDate !== today) {
      setSelectedDate(today);
    }
  }

  async function handleFormSave(payload: DailyCheckInFormPayload) {
    const targetDate = activeFormDate ?? today;

    setFormSaving(true);
    try {
      await saveEntryForDate(targetDate, activeFormMode, payload);
      setSelectedDate(targetDate);
      setActiveFormDate(null);
      setActiveFormInitial(undefined);
      setTodayQuickPrefill(undefined);
    } finally {
      setFormSaving(false);
    }
  }

  async function onTodayQuickLog(state: QuickCheckInState) {
    setTodayQuickLoadingState(state);
    const prefill = quickPrefillForState(state);
    setTodayQuickPrefill(prefill);
    openFormForDate(today, prefill);
    setTodayQuickLoadingState(null);
  }

  async function onDownloadReport() {
    const all = await api<LogEntry[]>("/log/entries", { method: "GET" });
    const last30 = all.filter((entry) => isWithinLastNDays(entry.date, 30));

    const safeProfile: Profile = profile ?? {
      procedureName: "Procedure",
      recoveryStartDate: today,
    };

    const html = buildClinicianReportHtml({
      profile: safeProfile,
      entries: last30,
      rangeLabel: "Last 30 days (rolling)",
    });

    const filename = `frederick-recovery-report-${today}.pdf`;
    await downloadPdfReport(filename, html);
  }

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.date === selectedDate) ?? null,
    [entries, selectedDate]
  );

  const activeDate = activeFormDate ?? today;
  const isTodayView = activeDate === today;
  const showingForm = activeFormDate !== null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
            Recovery
          </p>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {showingForm && !isTodayView
                ? "Update your recovery log"
                : todayEntry && !showingForm
                  ? "Today's check-in"
                  : "Today's check-in"}
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              {showingForm && !isTodayView
                ? `Review ${formatLongDate(activeDate)} and make any updates.`
                : `Log how you're feeling for ${formatLongDate(today)}.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground"
            onClick={() => navigate("/home")}
          >
            <House className="h-4 w-4" />
            Portal Home
          </Button>

          <Button
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground"
            onClick={onLogout}
          >
            Log out
          </Button>
        </div>
      </div>

      <section className="rounded-[28px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:p-7">
        {!showingForm ? (
          todayEntry ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50/70 px-4 py-4 text-sm text-emerald-950/80 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="font-medium">{formatLongDate(today)}</div>
                  <div className="text-xs text-emerald-900/65 sm:text-sm">
                    Today’s check-in is saved and ready if you need to update it.
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="h-9 self-start rounded-full px-4 text-emerald-900 hover:bg-emerald-100 sm:self-auto"
                  onClick={() => openFormForDate(today)}
                >
                  Edit today
                </Button>
              </div>

              <DayEntrySummary
                selectedDate={today}
                entry={todayEntry}
                onEdit={() => openFormForDate(today)}
              />
            </div>
          ) : (
            <QuickCheckIn
              loadingState={todayQuickLoadingState}
              onQuickLog={onTodayQuickLog}
              onGoToFullLog={() => {
                setTodayQuickPrefill(undefined);
                openFormForDate(today);
              }}
              onDismiss={() => {
                setTodayQuickPrefill(undefined);
                openFormForDate(today);
              }}
            />
          )
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-2xl bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950/80 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium">{formatLongDate(activeDate)}</div>
                <div className="mt-1 text-xs text-emerald-900/65 sm:text-sm">
                  {activeDate === today
                    ? activeFormMode === "edit"
                      ? "Update today’s entry."
                      : "Complete today’s check-in."
                    : "Review this entry and make any updates."}
                </div>
              </div>

              {activeDate !== today ? (
                <Button
                  variant="ghost"
                  className="h-9 self-start rounded-full px-4 text-emerald-900 hover:bg-emerald-100 sm:self-auto"
                  onClick={closeActiveForm}
                >
                  Back to today
                </Button>
              ) : null}
            </div>

            <div className="mt-5">
              <DailyCheckInForm
                mode={activeFormMode}
                date={activeDate}
                initial={activeFormInitial ?? todayQuickPrefill}
                saving={formSaving}
                onSave={handleFormSave}
                onClose={closeActiveForm}
              />
            </div>
          </>
        )}
      </section>

      <section className="rounded-[28px] border border-black/5 bg-stone-50/80 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Recent history
            </h2>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Review recent entries or reopen a day to make changes.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              variant="ghost"
              className="h-10 w-full rounded-full px-4 text-muted-foreground hover:bg-white sm:h-9 sm:w-auto"
              onClick={() => {
                setSelectedDate(todayLocalYYYYMMDD());
                setViewOpen((open) => !open || selectedDate !== todayLocalYYYYMMDD());
              }}
              disabled={loadingList}
            >
              <Eye className="h-4 w-4" />
              {loadingList ? "Loading history..." : viewOpen ? "Hide history" : "View history"}
            </Button>

            <Button
              variant="ghost"
              className="h-10 w-full rounded-full px-4 text-muted-foreground hover:bg-white sm:h-9 sm:w-auto"
              onClick={() => void onDownloadReport()}
              disabled={loadingList}
            >
              <Download className="h-4 w-4" />
              {loadingList ? "History loading..." : "Download report"}
            </Button>
          </div>
        </div>

        {viewOpen ? (
          <div className="mt-5 space-y-4">
            <div className="text-sm text-muted-foreground">
              Select a date to review or edit.
            </div>

            <WeekLogPicker
              entries={entries}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              windowDays={30}
              weekStartsOn={0}
            />

            <DayEntrySummary
              selectedDate={selectedDate}
              entry={selectedEntry}
              onEdit={(date) => {
                setViewOpen(false);
                openFormForDate(date);
              }}
            />
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-black/8 bg-white/70 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {loadingList
                ? "Loading recent entries..."
                : "Open recent history to review saved days or make an update."}
            </span>
            <Button
              variant="ghost"
              className="h-9 self-start rounded-full px-4 text-muted-foreground hover:bg-white sm:self-auto"
              onClick={() => {
                setSelectedDate(today);
                setViewOpen(true);
              }}
            >
              Latest entry
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
