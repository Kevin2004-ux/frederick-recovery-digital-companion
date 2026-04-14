import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardState = {
  // v2 fields (frontend draft for now)
  painLevel: number; // 1-10 (matches backend v1 constraints for now)
  painCompared: "Better" | "Same" | "Worse" | "";
  swellingToday: "None" | "Mild" | "Moderate" | "Severe" | "";
  swellingCompared: "Better" | "Same" | "Worse" | "";

  movedAsRecommended: "Yes" | "Somewhat" | "No" | "";
  difficultyActivities: "None" | "Mild" | "Significant" | "";
  tookMeds: "Yes" | "Missed one" | "Missed multiple" | "";
  sideEffects: Array<"None" | "Nausea" | "Dizziness" | "Constipation" | "Other">;
  sideEffectsOtherText: string;
  nonMedRelief: Array<"Ice" | "Compression" | "Elevation" | "Rest" | "None">;

  siteChange: "No" | "Slight" | "Significant" | "";
  drainage: "None" | "Clear" | "Bloody" | "Yellow-green" | "";
  redFlags: Array<
    "Fever" | "Shortness of breath" | "Chest pain" | "Severe swelling/pain" | "Sudden worsening" | "None"
  >;

  sleepHours: string; // keep as string for input control
  sleepQuality: "Poor" | "Fair" | "Good" | "Excellent" | "";
  eatNormally: "Yes" | "Somewhat" | "No" | "";
  fluidIntake: "Low" | "Adequate" | "High" | "";
  mood: "Positive" | "Neutral" | "Low" | "";
  anxiety: "Not at all" | "Somewhat" | "Very" | "";
  notes: string;
};

const TOTAL_STEPS = 4;

function defaultState(): WizardState {
  return {
    painLevel: 5,
    painCompared: "",
    swellingToday: "",
    swellingCompared: "",

    movedAsRecommended: "",
    difficultyActivities: "",
    tookMeds: "",
    sideEffects: ["None"],
    sideEffectsOtherText: "",
    nonMedRelief: ["None"],

    siteChange: "",
    drainage: "",
    redFlags: ["None"],

    sleepHours: "",
    sleepQuality: "",
    eatNormally: "",
    fluidIntake: "",
    mood: "",
    anxiety: "",
    notes: "",
  };
}

function draftKey(date: string) {
  return `frdc_draft_${date}`;
}

function safeParseDraft(raw: string | null): WizardState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WizardState;
    // minimal shape check
    if (typeof parsed?.painLevel !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function toggleMulti<T extends string>(arr: T[], value: T): T[] {
  const has = arr.includes(value);
  const next = has ? arr.filter((v) => v !== value) : [...arr, value];
  return next;
}

function enforceNoneExclusive<T extends string>(arr: T[], noneValue: T): T[] {
  // If "None" selected alongside others, remove "None".
  // If user selects only "None", keep it.
  if (arr.includes(noneValue) && arr.length > 1) {
    return arr.filter((v) => v !== noneValue);
  }
  if (!arr.length) return [noneValue];
  return arr;
}

function optionButtonClass(selected: boolean) {
  return `rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
    selected
      ? "border-emerald-900/10 bg-emerald-600 text-white shadow-sm"
      : "border-black/8 bg-white text-foreground hover:bg-stone-50"
  }`;
}

function checkboxOptionClass(checked: boolean) {
  return cn(
    "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm transition-colors",
    checked
      ? "border-emerald-900/10 bg-emerald-50 text-foreground"
      : "border-black/8 bg-white hover:bg-stone-50"
  );
}

type Props = {
  mode: "create" | "edit";
  date: string; // YYYY-MM-DD
  initial?: Partial<WizardState>;
  onCancel: () => void;

  /**
   * For Step 1 we keep backend unchanged.
   * So onSaveSnapshot will store ONLY what backend supports (painLevel, swellingLevel, notes).
   */
  onSaveSnapshot: (payload: {
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  details: Record<string, unknown>;
}) => Promise<void>;

};

export default function CheckInWizard({ mode, date, initial, onCancel, onSaveSnapshot }: Props) {
  const [step, setStep] = useState(1);

  const [state, setState] = useState<WizardState>(() => {
    const fromDraft = safeParseDraft(localStorage.getItem(draftKey(date)));
    const base = fromDraft ?? defaultState();
    return { ...base, ...(initial ?? {}) };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Persist draft per-date
  useEffect(() => {
    localStorage.setItem(draftKey(date), JSON.stringify(state));
  }, [date, state]);

  const title = useMemo(() => {
    if (step === 1) return "Pain & swelling";
    if (step === 2) return "Movement & medication";
    if (step === 3) return "Healing & safety";
    return "Sleep, mood & notes";
  }, [step]);

  const stepNote = useMemo(() => {
    if (step === 1) return "Start with how you're feeling today.";
    if (step === 2) return "Add a quick update on movement and medication.";
    if (step === 3) return "Note any healing changes or warning signs.";
    return "Finish with sleep, mood, and any notes you want to keep.";
  }, [step]);

  // Derived swellingLevel for backend snapshot (1–10)
  const derivedSwellingLevel = useMemo(() => {
    switch (state.swellingToday) {
      case "None":
        return 1;
      case "Mild":
        return 3;
      case "Moderate":
        return 6;
      case "Severe":
        return 9;
      default:
        return 5;
    }
  }, [state.swellingToday]);

  const hasRedFlag = useMemo(() => {
    return state.redFlags.some((f) => f !== "None");
  }, [state.redFlags]);

  function back() {
    setSaveError(null);
    setSaveSuccess(null);
    setStep((s) => Math.max(1, s - 1));
  }

  function next() {
    setSaveError(null);
    setSaveSuccess(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  async function saveSnapshotNow() {
    setSaveError(null);
    setSaveSuccess(null);

    setSaving(true);
    try {
     await onSaveSnapshot({
  painLevel: state.painLevel,
  swellingLevel: derivedSwellingLevel,
  notes: state.notes.trim() ? state.notes.trim() : undefined,
  details: state,
});


      // Keep draft behavior: clear draft on success so reopening is clean
      localStorage.removeItem(draftKey(date));
      setSaveSuccess(mode === "edit" ? "Check-in updated." : "Check-in saved.");
    } catch {
      setSaveError("Could not save your check-in. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function clearDraft() {
    localStorage.removeItem(draftKey(date));
    setState(defaultState());
    setSaveError(null);
    setSaveSuccess(null);
    setStep(1);
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
              Step {step} of {TOTAL_STEPS}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {title}
              </h2>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {stepNote}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="h-9 self-start rounded-full px-3 text-muted-foreground sm:self-auto"
            onClick={onCancel}
          >
            Close
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
            const active = index + 1 <= step;
            return (
              <div
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  active ? "bg-emerald-600" : "bg-stone-200"
                )}
              />
            );
          })}
        </div>

        <div className="text-sm text-muted-foreground">
          {mode === "edit" ? "Updating" : "Check-in for"}{" "}
          <span className="font-medium text-foreground">{date}</span>
        </div>
      </div>

        {/* STEP CONTENT */}
        {step === 1 ? (
          <div className="space-y-6 sm:space-y-7">
            {/* Pain level */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Pain level</label>
                <div className="rounded-full bg-stone-100 px-2.5 py-1 text-sm text-muted-foreground">
                  {state.painLevel}/10
                </div>
              </div>
              <input
                className="w-full"
                type="range"
                min={1}
                max={10}
                value={state.painLevel}
                onChange={(e) => setState((s) => ({ ...s, painLevel: Number(e.target.value) }))}
              />
            </div>

            {/* Pain compared */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Pain compared with yesterday</div>
              <div className="flex flex-wrap gap-2">
                {(["Better", "Same", "Worse"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.painCompared === opt)}
                    onClick={() => setState((s) => ({ ...s, painCompared: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Swelling today */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Swelling today</div>
              <div className="flex flex-wrap gap-2">
                {(["None", "Mild", "Moderate", "Severe"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.swellingToday === opt)}
                    onClick={() => setState((s) => ({ ...s, swellingToday: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Swelling compared */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Swelling compared with yesterday</div>
              <div className="flex flex-wrap gap-2">
                {(["Better", "Same", "Worse"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.swellingCompared === opt)}
                    onClick={() => setState((s) => ({ ...s, swellingCompared: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6 sm:space-y-7">
            <div className="space-y-3">
              <div className="text-sm font-medium">Movement today</div>
              <div className="flex flex-wrap gap-2">
                {(["Yes", "Somewhat", "No"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.movedAsRecommended === opt)}
                    onClick={() => setState((s) => ({ ...s, movedAsRecommended: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Daily activities</div>
              <div className="flex flex-wrap gap-2">
                {(["None", "Mild", "Significant"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.difficultyActivities === opt)}
                    onClick={() => setState((s) => ({ ...s, difficultyActivities: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Medication today</div>
              <div className="flex flex-wrap gap-2">
                {(["Yes", "Missed one", "Missed multiple"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.tookMeds === opt)}
                    onClick={() => setState((s) => ({ ...s, tookMeds: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Side effects (select all that apply)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["None", "Nausea", "Dizziness", "Constipation", "Other"] as const).map((opt) => {
                  const checked = state.sideEffects.includes(opt);
                  return (
                    <label key={opt} className={checkboxOptionClass(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = toggleMulti(state.sideEffects, opt);
                          const normalized = enforceNoneExclusive(next, "None");
                          setState((s) => ({
                            ...s,
                            sideEffects: normalized,
                            sideEffectsOtherText: opt === "Other" && !normalized.includes("Other") ? "" : s.sideEffectsOtherText,
                          }));
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>

              {state.sideEffects.includes("Other") ? (
                <Input
                  value={state.sideEffectsOtherText}
                  onChange={(e) => setState((s) => ({ ...s, sideEffectsOtherText: e.target.value }))}
                  placeholder="Other side effect (optional)"
                />
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Non-med pain relief (select all that apply)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["Ice", "Compression", "Elevation", "Rest", "None"] as const).map((opt) => {
                  const checked = state.nonMedRelief.includes(opt);
                  return (
                    <label key={opt} className={checkboxOptionClass(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = toggleMulti(state.nonMedRelief, opt);
                          const normalized = enforceNoneExclusive(next, "None");
                          setState((s) => ({ ...s, nonMedRelief: normalized }));
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6 sm:space-y-7">
            <div className="space-y-3">
              <div className="text-sm font-medium">Site change vs yesterday</div>
              <div className="flex flex-wrap gap-2">
                {(["No", "Slight", "Significant"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.siteChange === opt)}
                    onClick={() => setState((s) => ({ ...s, siteChange: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Drainage</div>
              <div className="flex flex-wrap gap-2">
                {(["None", "Clear", "Bloody", "Yellow-green"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.drainage === opt)}
                    onClick={() => setState((s) => ({ ...s, drainage: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Symptoms to watch</div>
              <div className="grid gap-2">
                {(
                  ["None", "Fever", "Shortness of breath", "Chest pain", "Severe swelling/pain", "Sudden worsening"] as const
                ).map((opt) => {
                  const checked = state.redFlags.includes(opt);
                  return (
                    <label key={opt} className={checkboxOptionClass(checked)}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = toggleMulti(state.redFlags, opt);
                          const normalized = enforceNoneExclusive(next, "None");
                          setState((s) => ({ ...s, redFlags: normalized }));
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>

              {hasRedFlag ? (
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-950">
                  <div className="text-sm">
                    This app does not provide medical advice. If symptoms are severe or getting worse, contact your
                    surgeon or clinic.
                  </div>
                </Alert>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-6 sm:space-y-7">
            <div className="space-y-3">
              <label className="text-sm font-medium">Sleep hours</label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                value={state.sleepHours}
                onChange={(e) => setState((s) => ({ ...s, sleepHours: e.target.value }))}
                placeholder="e.g., 7.5"
              />
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Sleep quality</div>
              <div className="flex flex-wrap gap-2">
                {(["Poor", "Fair", "Good", "Excellent"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.sleepQuality === opt)}
                    onClick={() => setState((s) => ({ ...s, sleepQuality: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Eat normally</div>
              <div className="flex flex-wrap gap-2">
                {(["Yes", "Somewhat", "No"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.eatNormally === opt)}
                    onClick={() => setState((s) => ({ ...s, eatNormally: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Fluid intake</div>
              <div className="flex flex-wrap gap-2">
                {(["Low", "Adequate", "High"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.fluidIntake === opt)}
                    onClick={() => setState((s) => ({ ...s, fluidIntake: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Mood</div>
              <div className="flex flex-wrap gap-2">
                {(["Positive", "Neutral", "Low"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.mood === opt)}
                    onClick={() => setState((s) => ({ ...s, mood: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Stress or discouragement</div>
              <div className="flex flex-wrap gap-2">
                {(["Not at all", "Somewhat", "Very"] as const).map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={optionButtonClass(state.anxiety === opt)}
                    onClick={() => setState((s) => ({ ...s, anxiety: opt }))}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                value={state.notes}
                onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Sleep, meds, appetite, mobility, concerns…"
                className="min-h-[96px]"
              />
            </div>

            {saveSuccess ? (
              <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-950">
                <div className="text-sm">{saveSuccess}</div>
              </Alert>
            ) : null}

            {saveError ? (
              <Alert className="rounded-2xl border-red-200 bg-red-50 text-red-950">
                <div className="text-sm">{saveError}</div>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                className="h-10 w-full rounded-full px-4 text-muted-foreground sm:h-9 sm:w-auto"
                onClick={clearDraft}
                disabled={saving}
              >
                Clear answers
              </Button>

              <Button
                className="h-11 w-full rounded-full px-5 sm:h-10 sm:w-auto"
                onClick={saveSnapshotNow}
                disabled={saving}
              >
                {saving ? (
                  <>Saving check-in…</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save check-in
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {/* NAV CONTROLS */}
        <div className="flex flex-col gap-2 border-t border-black/5 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Button
            variant="ghost"
            className="h-10 w-full rounded-full px-3 text-muted-foreground sm:h-9 sm:w-auto"
            onClick={back}
            disabled={step === 1 || saving}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              className="h-11 w-full rounded-full px-5 sm:h-10 sm:w-auto"
              onClick={next}
              disabled={saving}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground sm:text-right">
              Review your answers, then save.
            </div>
          )}
        </div>
    </div>
  );
}
