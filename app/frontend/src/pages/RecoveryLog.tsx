import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { clearToken } from "@/auth/token";

import CheckInWizard, { WizardState } from "@/components/log/CheckInWizard";
import { WeekLogPicker } from "@/components/log/WeekLogPicker";
import { DayEntrySummary } from "@/components/log/DayEntrySummary";
import {
  buildClinicianReportHtml,
  downloadPdfReport,
} from "@/components/log/reportExport";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Eye, Download } from "lucide-react";

type LogEntry = {
  date: string; // YYYY-MM-DD
  painLevel: number; // 1-10
  swellingLevel: number; // 1-10
  notes?: string;
  schemaVersion: number;
  details?: Record<string, unknown>;
};

type Profile = {
  procedureName: string;
  recoveryStartDate: string; // YYYY-MM-DD
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
  // local midnight
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function isWithinLastNDays(dateStr: string, n: number): boolean {
  const dt = parseLocalDateYYYYMMDD(dateStr);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const min = new Date(today);
  min.setDate(min.getDate() - (n - 1));

  return dt >= min && dt <= today;
}

export default function RecoveryLog() {
  const navigate = useNavigate();

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  // View UI
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayLocalYYYYMMDD());

  // Wizard UI state
  const [wizardDate, setWizardDate] = useState(todayLocalYYYYMMDD());
  const [wizardMode, setWizardMode] = useState<"create" | "edit">("create");
  const [wizardInitial, setWizardInitial] = useState<
    Partial<WizardState> | undefined
  >(undefined);
  const [wizardKey, setWizardKey] = useState(0);

  const todayEntry = useMemo(
    () => entries.find((e) => e.date === todayLocalYYYYMMDD()) ?? null,
    [entries]
  );

  async function loadEntries(): Promise<LogEntry[]> {
    setLoadingList(true);
    try {
      const data = await api<LogEntry[]>("/log/entries", { method: "GET" });
      // Newest first in UI
      const sorted = [...data].sort((a, b) => (a.date < b.date ? 1 : -1));
      setEntries(sorted);
      return sorted;
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<Profile>("/user/profile", { method: "GET" })
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  // Keep wizard mode synced for today when user is on today
  useEffect(() => {
    const today = todayLocalYYYYMMDD();
    const existing = entries.find((e) => e.date === today) ?? null;
    if (wizardDate !== today) return;

    setWizardMode(existing ? "edit" : "create");
    setWizardInitial(
      existing
        ? {
            painLevel: existing.painLevel,
            notes: existing.notes ?? "",
          }
        : undefined
    );
  }, [entries, wizardDate]);

  function openWizardForDate(targetDate: string) {
    const existing = entries.find((e) => e.date === targetDate) ?? null;

    setWizardDate(targetDate);
    setWizardMode(existing ? "edit" : "create");
    setWizardInitial(
      existing
        ? {
            painLevel: existing.painLevel,
            notes: existing.notes ?? "",
          }
        : undefined
    );

    setWizardKey((k) => k + 1);
  }

  async function saveWizardSnapshot(payload: {
    painLevel: number;
    swellingLevel: number;
    notes?: string;
    details: Record<string, unknown>;
  }) {
    if (wizardMode === "edit") {
      await api<LogEntry>(`/log/entries/${encodeURIComponent(wizardDate)}`, {
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
          date: wizardDate,
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

  async function onDownloadReport() {
    // Pull all entries, then filter to rolling 30 days
    const all = await api<LogEntry[]>("/log/entries", { method: "GET" });
    const last30 = all.filter((e) => isWithinLastNDays(e.date, 30));

    // Fallback profile if not loaded (should be rare)
    const safeProfile: Profile = profile ?? {
      procedureName: "Procedure",
      recoveryStartDate: todayLocalYYYYMMDD(),
    };

    const html = buildClinicianReportHtml({
      profile: safeProfile,
      entries: last30,
      rangeLabel: "Last 30 days (rolling)",
    });

    const filename = `frederick-recovery-report-${todayLocalYYYYMMDD()}.pdf`;
    await downloadPdfReport(filename, html);
  }

  const selectedEntry = useMemo(
    () => entries.find((e) => e.date === selectedDate) ?? null,
    [entries, selectedDate]
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Recovery Log</h1>
        <Button variant="outline" className="rounded-xl" onClick={onLogout}>
          Log out
        </Button>
      </div>

      {/* Wizard-first card */}
      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Today’s check-in</h2>
          <p className="text-sm text-muted-foreground">
            Step-by-step check-in. You can export anytime for your clinic.
          </p>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="font-medium">Date:</span>{" "}
              <span className="font-mono">{wizardDate}</span>
              {wizardDate === todayLocalYYYYMMDD() && todayEntry ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  (editing today)
                </span>
              ) : null}
            </div>

            {wizardDate !== todayLocalYYYYMMDD() ? (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => openWizardForDate(todayLocalYYYYMMDD())}
              >
                Back to today
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <CheckInWizard
            key={wizardKey}
            mode={wizardMode}
            date={wizardDate}
            initial={wizardInitial}
            onCancel={() => openWizardForDate(todayLocalYYYYMMDD())}
            onSaveSnapshot={saveWizardSnapshot}
          />
        </div>
      </Card>

      {/* Log history: Week-at-a-time picker + details AFTER selection */}
      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Log history</h3>
            <p className="text-sm text-muted-foreground">
              Browse the last 30 days week-by-week. Tap a day to view details.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setSelectedDate(todayLocalYYYYMMDD());
                setViewOpen(true);
              }}
              disabled={loadingList}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>

            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void onDownloadReport()}
              disabled={loadingList}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </div>

        {viewOpen ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Week view (last 30 days)
              </div>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setViewOpen(false)}
              >
                Close
              </Button>
            </div>

            <WeekLogPicker
              entries={entries}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              windowDays={30}
              weekStartsOn={0}
            />

            {/* Details appear after selecting a date */}
            <DayEntrySummary
              selectedDate={selectedDate}
              entry={selectedEntry}
              onEdit={(d) => {
                setViewOpen(false);
                openWizardForDate(d);
              }}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
