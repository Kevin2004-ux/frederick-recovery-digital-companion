import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/api/client";
import { getToken } from "@/auth/token";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, PlusCircle } from "lucide-react";

type LogEntry = {
  date: string; // YYYY-MM-DD
  painLevel: number; // 1-10
  swellingLevel: number; // 1-10
  notes?: string;
  schemaVersion: number;
};

function todayLocalYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.code === "VALIDATION_ERROR") return "Please check the fields and try again.";
  if (err?.code === "ENTRY_ALREADY_EXISTS") return "An entry for this date already exists.";
  return "Something went wrong. Please try again.";
}

/**
 * Downloads exports (JSON/CSV) using raw fetch because these are file responses.
 * NOTE: this does not auto-handle gate routing the way api() does.
 * If token is invalid due to backend restart, the download may fail—user will then
 * naturally hit an api() call and be routed to /login.
 */
async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export default function RecoveryLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [date, setDate] = useState(todayLocalYYYYMMDD());
  const [painLevel, setPainLevel] = useState(5);
  const [swellingLevel, setSwellingLevel] = useState(5);
  const [notes, setNotes] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const [exportLoading, setExportLoading] = useState<"json" | "csv" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const isDuplicateForSelectedDate = useMemo(() => {
    return entries.some((e) => e.date === date);
  }, [entries, date]);

  async function loadEntries(): Promise<LogEntry[]> {
    setLoadingList(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const path = qs.toString() ? `/log/entries?${qs.toString()}` : "/log/entries";
      const data = await api<LogEntry[]>(path, { method: "GET" });

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

  async function onApplyFilter() {
    await loadEntries();
  }

  async function onSubmit() {
    setSubmitError(null);
    setSubmitSuccess(null);

    setSubmitLoading(true);
    try {
      await api<LogEntry>("/log/entries", {
        method: "POST",
        json: {
          date,
          painLevel,
          swellingLevel,
          notes: notes.trim() ? notes.trim() : undefined,
        },
      });

      setSubmitSuccess("Saved. Nice job staying consistent.");
      setNotes("");

      // Refresh list — but don't punish user if refresh fails
      try {
        await loadEntries();
      } catch {
        // ignore list refresh errors
      }
    } catch (e) {
      const err = e as Partial<ApiError>;

      if (err?.code === "ENTRY_ALREADY_EXISTS") {
        setSubmitError("You already submitted an entry for this date.");
        return;
      }

      // IMPORTANT FIX:
      // Sometimes a request can succeed but the UI sees an error (network blip, non-JSON edge case, etc.).
      // We re-load the list and verify whether today's entry exists. If it does, treat as saved.
      try {
        const refreshed = await loadEntries();
        const nowExists = refreshed.some((en) => en.date === date);
        if (nowExists) {
          setSubmitSuccess("Saved (confirmed).");
          setSubmitError(null);
          setNotes("");
          return;
        }
      } catch {
        // ignore; show error below
      }

      setSubmitError(formatError(e));
    } finally {
      setSubmitLoading(false);
    }
  }

  async function onExportJson() {
    setExportError(null);
    setExportLoading("json");
    try {
      await downloadFile("/log/entries/export", "frederick-recovery-log.json");
    } catch {
      setExportError("Could not download JSON export.");
    } finally {
      setExportLoading(null);
    }
  }

  async function onExportCsv() {
    setExportError(null);
    setExportLoading("csv");
    try {
      await downloadFile("/log/entries/export.csv", "frederick-recovery-log.csv");
    } catch {
      setExportError("Could not download CSV export.");
    } finally {
      setExportLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Today’s check-in</h2>
          <p className="text-sm text-muted-foreground">
            Track a quick snapshot. You can export anytime for your clinic.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pain level</label>
              <div className="text-sm text-muted-foreground">{painLevel}/10</div>
            </div>
            <input
              className="w-full"
              type="range"
              min={1}
              max={10}
              value={painLevel}
              onChange={(e) => setPainLevel(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Swelling level</label>
              <div className="text-sm text-muted-foreground">{swellingLevel}/10</div>
            </div>
            <input
              className="w-full"
              type="range"
              min={1}
              max={10}
              value={swellingLevel}
              onChange={(e) => setSwellingLevel(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sleep, meds, appetite, mobility, concerns…"
              className="min-h-[96px]"
            />
          </div>

          {submitSuccess ? (
            <Alert className="rounded-xl">
              <div className="text-sm">{submitSuccess}</div>
            </Alert>
          ) : null}

          {submitError ? (
            <Alert className="rounded-xl">
              <div className="text-sm">{submitError}</div>
            </Alert>
          ) : null}

          <Button
            className="w-full rounded-xl"
            onClick={onSubmit}
            disabled={submitLoading || isDuplicateForSelectedDate}
          >
            {submitLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isDuplicateForSelectedDate ? (
              "Entry already exists for this date"
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Save check-in
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold">Your entries</h3>
          <p className="text-sm text-muted-foreground">
            Filter by date range if needed.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <Button
          className="mt-4 w-full rounded-xl"
          variant="outline"
          onClick={onApplyFilter}
          disabled={loadingList}
        >
          {loadingList ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </>
          ) : (
            "Apply filter"
          )}
        </Button>

        <Separator className="my-5" />

        {loadingList ? (
          <div className="text-sm text-muted-foreground">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
            No entries yet. Add your first check-in above.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((e) => (
              <div key={e.date} className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{e.date}</div>
                  <div className="text-xs text-muted-foreground">v{e.schemaVersion}</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Pain: <span className="text-foreground">{e.painLevel}/10</span> • Swelling:{" "}
                  <span className="text-foreground">{e.swellingLevel}/10</span>
                </div>
                {e.notes ? <div className="mt-2 text-sm">{e.notes}</div> : null}
              </div>
            ))}
          </div>
        )}

        <Separator className="my-5" />

        {exportError ? (
          <Alert className="mb-4 rounded-xl">
            <div className="text-sm">{exportError}</div>
          </Alert>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Button
            className="rounded-xl"
            variant="outline"
            onClick={onExportJson}
            disabled={exportLoading !== null}
          >
            {exportLoading === "json" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                JSON
              </>
            )}
          </Button>

          <Button
            className="rounded-xl"
            variant="outline"
            onClick={onExportCsv}
            disabled={exportLoading !== null}
          >
            {exportLoading === "csv" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
