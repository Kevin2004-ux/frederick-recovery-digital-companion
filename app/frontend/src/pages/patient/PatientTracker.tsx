import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Save,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api, ApiError, clearTrackerDraft, loadTrackerDraft, saveTrackerDraft } from "@/api/client";
import { EntryCard } from "@/components/log/EntryCard";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildRecommendationsFromLog } from "@/features/recommendations/recommendationEngine";
import { addDays, formatDateYmd, getTodayYmd, startOfWeekSunday } from "@/lib/date";
import {
  createEmptyLogDetails,
  normalizeLogEntry,
  type Recommendation,
  type RecoveryLogEntry,
} from "@/types/log";

function getWeekDays(anchor: string) {
  const start = startOfWeekSunday(new Date(`${anchor}T00:00:00`));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index)).map((date) =>
    formatDateYmd(date),
  );
}

const redFlagOptions = ["feverOver101", "increasingPain", "increasingRedness", "chestPain"];

function clampScaleValue(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(10, Math.max(1, Math.round(value)));
}

export function PatientTracker() {
  const [entries, setEntries] = useState<Record<string, RecoveryLogEntry>>({});
  const [selectedDate, setSelectedDate] = useState(getTodayYmd());
  const [form, setForm] = useState<RecoveryLogEntry>(() =>
    normalizeLogEntry({ date: getTodayYmd() }),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    let active = true;
    void api
      .get<RecoveryLogEntry[]>("/log/entries")
      .then((response) => {
        if (!active) {
          return;
        }
        const nextMap = Object.fromEntries(
          response.map((entry) => [entry.date, normalizeLogEntry(entry)]),
        );
        setEntries(nextMap);
        setLoadError("");
      })
      .catch((caughtError) => {
        if (active) {
          setEntries({});
          setLoadError((caughtError as ApiError).message || "Unable to load previous check-ins.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const existing = entries[selectedDate];
    const draft = loadTrackerDraft(selectedDate);
    setForm(normalizeLogEntry(draft || existing || { date: selectedDate }));
  }, [entries, selectedDate]);

  useEffect(() => {
    saveTrackerDraft(selectedDate, form);
  }, [form, selectedDate]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const selectedEntry = entries[selectedDate] || null;
  const selectedRedFlagCount = form.details.redFlags.length;

  function updateDetails<K extends keyof RecoveryLogEntry["details"]>(
    key: K,
    value: RecoveryLogEntry["details"][K],
  ) {
    setForm((current) => ({
      ...current,
      details: {
        ...current.details,
        [key]: value,
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = normalizeLogEntry({
      ...form,
      date: selectedDate,
      painLevel: clampScaleValue(form.painLevel, 5),
      swellingLevel: clampScaleValue(form.swellingLevel, 5),
      schemaVersion: 2,
      details: {
        ...createEmptyLogDetails(),
        ...form.details,
      },
    });

    try {
      try {
        await api.put(`/log/entries/${selectedDate}`, {
          painLevel: payload.painLevel,
          swellingLevel: payload.swellingLevel,
          notes: payload.notes,
          details: payload.details,
        });
      } catch (caughtError) {
        const apiError = caughtError as ApiError;
        if (apiError.status === 404 || apiError.code === "NOT_FOUND") {
          await api.post("/log/entries", payload);
        } else {
          throw caughtError;
        }
      }

      clearTrackerDraft(selectedDate);
      setEntries((current) => ({
        ...current,
        [selectedDate]: payload,
      }));
      setForm(payload);
      setRecommendations(buildRecommendationsFromLog(payload));
      setSuccess("Check-in saved using the existing PUT-first, POST-fallback backend flow.");
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to save the check-in.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="bg-app pb-28">
      <div className="app-shell">
        <PageIntro
          description="This form preserves the backend log payload shape: date, painLevel, swellingLevel, notes, schemaVersion 2, and the full details object."
          eyebrow="Patient tracker"
          title="Daily recovery log"
        />

        {loadError ? (
          <StatePanel
            className="mb-5"
            description={loadError}
            title="Unable to load saved entries"
            tone="warning"
          />
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">Choose a day</h2>
                <p className="section-subtitle">
                  Tap a date to review or update your saved check-in.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDate}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const active = day === selectedDate;
                const hasEntry = Boolean(entries[day]);
                return (
                  <button
                    className={`rounded-[24px] px-2 py-3 text-center text-sm transition ${
                      active
                        ? "bg-brand-700 text-white shadow-soft"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    key={day}
                    onClick={() => setSelectedDate(day)}
                    type="button"
                  >
                    <div className="text-[10px] uppercase tracking-[0.15em] opacity-75">
                      {day.slice(5)}
                    </div>
                    <div className="mt-2 text-base font-semibold">{day.slice(-2)}</div>
                    {hasEntry ? <div className="mt-2 text-[10px]">{active ? "Saved" : "Logged"}</div> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="metric-card">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Thermometer className="h-4 w-4 text-rose-600" />
                  Pain level
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{form.painLevel}/10</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  Entry status
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950">
                  {selectedEntry ? "Saved" : "Draft"}
                </p>
              </div>
              <div className="metric-card">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Red flags
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950">{selectedRedFlagCount}</p>
              </div>
            </div>

            <div className="mt-6">
              <EntryCard
                entry={selectedEntry}
                onEdit={() => setForm(normalizeLogEntry(selectedEntry || { date: selectedDate }))}
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">Check-in for {selectedDate}</h2>
                <p className="section-subtitle">
                  Update today or a recent day using the live backend routes.
                </p>
              </div>
              {selectedEntry ? <Badge tone="success">Existing entry</Badge> : <Badge tone="info">New entry</Badge>}
            </div>

            <div className="mt-6 rounded-[28px] border border-slate-100 bg-slate-50/75 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-2 text-brand-700 shadow-sm">
                  <ChevronRight className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gentle, quick capture</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">
                    The layout is simpler now, but the saved payload still matches the backend
                    contract exactly.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="pain-level">
                  Pain level (1-10)
                </label>
                <input
                  className="field"
                  id="pain-level"
                  max={10}
                  min={1}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      painLevel: clampScaleValue(Number(event.target.value), current.painLevel),
                    }))
                  }
                  type="number"
                  value={form.painLevel}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="swelling-level">
                  Swelling level (1-10)
                </label>
                <input
                  className="field"
                  id="swelling-level"
                  max={10}
                  min={1}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      swellingLevel: clampScaleValue(Number(event.target.value), current.swellingLevel),
                    }))
                  }
                  type="number"
                  value={form.swellingLevel}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="mobility">
                  Mobility
                </label>
                <select
                  className="field"
                  id="mobility"
                  onChange={(event) => updateDetails("mobility", event.target.value)}
                  value={form.details.mobility}
                >
                  <option value="normal">Normal</option>
                  <option value="limited">Limited</option>
                  <option value="bedrest">Bed rest</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="drainage">
                  Drainage level
                </label>
                <select
                  className="field"
                  id="drainage"
                  onChange={(event) => updateDetails("drainageLevel", event.target.value)}
                  value={form.details.drainageLevel}
                >
                  <option value="none">None</option>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="redness">
                  Redness level
                </label>
                <select
                  className="field"
                  id="redness"
                  onChange={(event) => updateDetails("rednessLevel", event.target.value)}
                  value={form.details.rednessLevel}
                >
                  <option value="none">None</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="temperature">
                  Temperature (optional)
                </label>
                <input
                  className="field"
                  id="temperature"
                  onChange={(event) => updateDetails("temperatureF", event.target.value)}
                  value={form.details.temperatureF}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="sleep-hours">
                  Sleep hours
                </label>
                <input
                  className="field"
                  id="sleep-hours"
                  onChange={(event) => updateDetails("sleepHours", event.target.value)}
                  value={form.details.sleepHours}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="water-cups">
                  Water cups
                </label>
                <input
                  className="field"
                  id="water-cups"
                  onChange={(event) => updateDetails("waterCups", event.target.value)}
                  value={form.details.waterCups}
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Care reminders</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.details.warmth}
                    onChange={(event) => updateDetails("warmth", event.target.checked)}
                    type="checkbox"
                  />
                  Warmth around wound
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.details.odor}
                    onChange={(event) => updateDetails("odor", event.target.checked)}
                    type="checkbox"
                  />
                  Unusual odor
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.details.missedMeds}
                    onChange={(event) => updateDetails("missedMeds", event.target.checked)}
                    type="checkbox"
                  />
                  Missed medication dose
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.details.nausea}
                    onChange={(event) => updateDetails("nausea", event.target.checked)}
                    type="checkbox"
                  />
                  Nausea today
                </label>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">Red flags</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {redFlagOptions.map((flag) => {
                  const checked = form.details.redFlags.includes(flag);
                  return (
                    <label className="flex items-center gap-3 text-sm text-slate-700" key={flag}>
                      <input
                        checked={checked}
                        onChange={(event) => {
                          const nextFlags = event.target.checked
                            ? [...form.details.redFlags, flag]
                            : form.details.redFlags.filter((item) => item !== flag);
                          updateDetails("redFlags", nextFlags);
                        }}
                        type="checkbox"
                      />
                      {flag}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <label className="field-label" htmlFor="notes">
                Notes
              </label>
              <textarea
                className="field min-h-32 resize-y"
                id="notes"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                value={form.notes || ""}
              />
            </div>

            {error ? (
              <StatePanel
                className="mt-4"
                description={error}
                title="Unable to save check-in"
                tone="danger"
              />
            ) : null}

            {success ? (
              <StatePanel
                className="mt-4"
                description={success}
                title="Check-in saved"
                tone="success"
              />
            ) : null}

            <div className="floating-save mt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Save this recovery check-in</p>
                  <p className="mt-1 text-sm leading-7 text-slate-600">
                    PUT-first, POST-fallback behavior remains unchanged.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="justify-center" disabled={loading || saving} onClick={handleSave}>
                    <Save className="h-4 w-4" />
                    {saving ? "Saving..." : "Save check-in"}
                  </Button>
                  <Button
                    className="justify-center"
                    onClick={() => {
                      const base = normalizeLogEntry(selectedEntry || { date: selectedDate });
                      setForm(base);
                      clearTrackerDraft(selectedDate);
                    }}
                    variant="secondary"
                  >
                    Reset to saved
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {recommendations.length ? (
          <Card className="mt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Post-save recommendations</h2>
                <p className="section-subtitle">
                  Generated after save without changing the backend contract.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {recommendations.map((recommendation) => (
                <div
                  className="rounded-[26px] border border-slate-100 bg-slate-50/80 p-4"
                  key={recommendation.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{recommendation.title}</p>
                      <p className="mt-1 text-sm leading-7 text-slate-600">
                        {recommendation.description}
                      </p>
                    </div>
                    {recommendation.tone === "warning" ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <PatientBottomNav />
    </main>
  );
}
