import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ChevronDown, ChevronUp, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LevelSlider } from "@/components/shared/LevelSlider";
import { MedCard } from "@/components/shared/MedCard";
import { SegmentedControl } from "@/components/shared/SegmentedControl";

export type MedicationStatus = "took_it" | "missed_dose";
export type RedFlagKey =
  | "fever_over_101"
  | "pain_getting_worse"
  | "redness_spreading"
  | "chest_pain_breathing";
export type DrainageStatus = "" | "none" | "light" | "moderate" | "heavy";
export type RednessStatus = "" | "none" | "mild" | "moderate" | "severe";
export type YesNoStatus = "" | "yes" | "no";
export type MobilityLevel = "" | "normal" | "limited" | "bedrest";

export type DailyCheckInFormDetails = {
  medicationStatus: MedicationStatus;
  redFlags: RedFlagKey[];
  sideEffectsOrConcerns?: string;
  drainage?: Exclude<DrainageStatus, "">;
  rednessAroundIncision?: Exclude<RednessStatus, "">;
  warmthAroundWound?: Exclude<YesNoStatus, "">;
  unusualOdor?: Exclude<YesNoStatus, "">;
  mobility?: Exclude<MobilityLevel, "">;
};

export type DailyCheckInFormInitial = Partial<{
  painLevel: number;
  swellingLevel: number;
  notes: string;
  details: Partial<DailyCheckInFormDetails>;
}>;

export type DailyCheckInFormPayload = {
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  details: DailyCheckInFormDetails;
};

type DailyCheckInFormProps = {
  mode: "create" | "edit";
  date: string;
  initial?: DailyCheckInFormInitial;
  saving?: boolean;
  onSave: (payload: DailyCheckInFormPayload) => Promise<void>;
  onClose?: () => void;
  className?: string;
};

const RED_FLAG_OPTIONS: Array<{ key: RedFlagKey; label: string }> = [
  { key: "fever_over_101", label: "Fever over 101°F" },
  { key: "pain_getting_worse", label: "Pain getting worse" },
  { key: "redness_spreading", label: "Redness spreading" },
  { key: "chest_pain_breathing", label: "Chest pain / trouble breathing" },
];

function clampLevel(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.min(10, Math.max(1, Math.round(value)));
}

function hasExpandedDetails(initial?: DailyCheckInFormInitial) {
  const details = initial?.details;
  return Boolean(
    details?.drainage ||
      details?.rednessAroundIncision ||
      details?.warmthAroundWound ||
      details?.unusualOdor ||
      details?.mobility
  );
}

export default function DailyCheckInForm({
  mode,
  date,
  initial,
  saving = false,
  onSave,
  onClose,
  className,
}: DailyCheckInFormProps) {
  const [painLevel, setPainLevel] = useState(() =>
    clampLevel(initial?.painLevel, 4)
  );
  const [swellingLevel, setSwellingLevel] = useState(() =>
    clampLevel(initial?.swellingLevel, 3)
  );
  const [medicationStatus, setMedicationStatus] = useState<MedicationStatus>(
    initial?.details?.medicationStatus ?? "took_it"
  );
  const [redFlags, setRedFlags] = useState<RedFlagKey[]>(
    initial?.details?.redFlags ?? []
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showMoreDetail, setShowMoreDetail] = useState(() =>
    hasExpandedDetails(initial)
  );
  const [sideEffectsOrConcerns, setSideEffectsOrConcerns] = useState(
    initial?.details?.sideEffectsOrConcerns ?? ""
  );
  const [drainage, setDrainage] = useState<DrainageStatus>(
    initial?.details?.drainage ?? ""
  );
  const [rednessAroundIncision, setRednessAroundIncision] =
    useState<RednessStatus>(initial?.details?.rednessAroundIncision ?? "");
  const [warmthAroundWound, setWarmthAroundWound] = useState<YesNoStatus>(
    initial?.details?.warmthAroundWound ?? ""
  );
  const [unusualOdor, setUnusualOdor] = useState<YesNoStatus>(
    initial?.details?.unusualOdor ?? ""
  );
  const [mobility, setMobility] = useState<MobilityLevel>(
    initial?.details?.mobility ?? ""
  );

  const saveLabel = mode === "edit" ? "Update check-in" : "Save check-in";
  const hasRedFlags = redFlags.length > 0;

  const details = useMemo<DailyCheckInFormDetails>(
    () => ({
      medicationStatus,
      redFlags,
      sideEffectsOrConcerns:
        medicationStatus === "missed_dose" && sideEffectsOrConcerns.trim()
          ? sideEffectsOrConcerns.trim()
          : undefined,
      drainage: drainage || undefined,
      rednessAroundIncision: rednessAroundIncision || undefined,
      warmthAroundWound: warmthAroundWound || undefined,
      unusualOdor: unusualOdor || undefined,
      mobility: mobility || undefined,
    }),
    [
      drainage,
      medicationStatus,
      mobility,
      rednessAroundIncision,
      redFlags,
      sideEffectsOrConcerns,
      unusualOdor,
      warmthAroundWound,
    ]
  );

  async function handleSave() {
    await onSave({
      painLevel,
      swellingLevel,
      notes: notes.trim() || undefined,
      details,
    });
  }

  function toggleRedFlag(key: RedFlagKey) {
    setRedFlags((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  return (
    <Card className={cn("overflow-hidden bg-white/95 p-5 sm:p-6", className)}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
              Daily check-in
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {mode === "edit" ? "Update check-in" : "Today’s check-in"}
              </h2>
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{date}</span>
              </div>
            </div>
          </div>

          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground"
              onClick={onClose}
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="space-y-4">
          <LevelSlider
            label="Pain level"
            value={painLevel}
            min={1}
            max={10}
            onChange={setPainLevel}
            hint="1 is very low. 10 is severe."
          />

          <LevelSlider
            label="Swelling level"
            value={swellingLevel}
            min={1}
            max={10}
            onChange={setSwellingLevel}
            hint="Track how noticeable swelling feels today."
          />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Medications taken today?
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MedCard
              title="Took it"
              subtitle="Medication was taken as planned today."
              selected={medicationStatus === "took_it"}
              onClick={() => setMedicationStatus("took_it")}
            />
            <MedCard
              title="Missed a dose"
              subtitle="A dose was missed or delayed today."
              selected={medicationStatus === "missed_dose"}
              onClick={() => setMedicationStatus("missed_dose")}
            />
          </div>

          {medicationStatus === "missed_dose" ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Side effects or concerns
              </label>
              <Textarea
                value={sideEffectsOrConcerns}
                onChange={(e) => setSideEffectsOrConcerns(e.target.value)}
                placeholder="Share any side effects, concerns, or reason the dose was missed."
                className="min-h-[104px]"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">
              Warning signs today?
            </div>
            <p className="text-sm text-muted-foreground">
              Select any symptoms that need extra attention.
            </p>
          </div>

          <div className="grid gap-2">
            {RED_FLAG_OPTIONS.map((option) => {
              const selected = redFlags.includes(option.key);

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleRedFlag(option.key)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors",
                    selected
                      ? "border-amber-300 bg-white text-foreground"
                      : "border-amber-200/70 bg-transparent text-muted-foreground hover:bg-white/70"
                  )}
                >
                  <span>{option.label}</span>
                  <span
                    className={cn(
                      "h-4 w-4 rounded-full border",
                      selected ? "border-amber-500 bg-amber-500" : "border-amber-300"
                    )}
                  />
                </button>
              );
            })}
          </div>

          {hasRedFlags ? (
            <Alert className="rounded-2xl border-amber-200 bg-white/80 text-amber-950">
              <div className="flex items-start gap-3 text-sm leading-6">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This app is not monitored 24/7. If you are experiencing a
                  medical emergency, call 911 or go to the nearest emergency
                  room immediately.
                </span>
              </div>
            </Alert>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Additional notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything you want to remember about today."
            className="min-h-[120px]"
          />
        </div>

        <div className="space-y-3 rounded-2xl bg-stone-50/80 p-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between rounded-xl px-0 text-foreground hover:bg-transparent"
            onClick={() => setShowMoreDetail((current) => !current)}
          >
            <span className="text-sm font-medium">Add more detail</span>
            {showMoreDetail ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>

          {showMoreDetail ? (
            <div className="space-y-4 pt-1">
              <div className="space-y-4 rounded-2xl bg-white/80 p-4">
                <div className="text-sm font-medium text-foreground">
                  Incision / wound status
                </div>

                <SegmentedControl
                  label="Drainage"
                  value={drainage}
                  onChange={setDrainage}
                  options={[
                    { label: "None", value: "none" },
                    { label: "Light", value: "light" },
                    { label: "Moderate", value: "moderate" },
                    { label: "Heavy", value: "heavy" },
                  ]}
                />

                <SegmentedControl
                  label="Redness around incision"
                  value={rednessAroundIncision}
                  onChange={setRednessAroundIncision}
                  options={[
                    { label: "None", value: "none" },
                    { label: "Mild", value: "mild" },
                    { label: "Moderate", value: "moderate" },
                    { label: "Severe", value: "severe" },
                  ]}
                />

                <SegmentedControl
                  label="Warmth around wound"
                  value={warmthAroundWound}
                  onChange={setWarmthAroundWound}
                  options={[
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                  ]}
                />

                <SegmentedControl
                  label="Unusual odor"
                  value={unusualOdor}
                  onChange={setUnusualOdor}
                  options={[
                    { label: "Yes", value: "yes" },
                    { label: "No", value: "no" },
                  ]}
                />
              </div>

              <div className="rounded-2xl bg-white/80 p-4">
                <SegmentedControl
                  label="Mobility level"
                  value={mobility}
                  onChange={setMobility}
                  options={[
                    { label: "Normal", value: "normal" },
                    { label: "Limited", value: "limited" },
                    { label: "Bedrest", value: "bedrest" },
                  ]}
                />
              </div>
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          className="h-12 w-full rounded-full text-[15px]"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? "Saving..." : saveLabel}
        </Button>
      </div>
    </Card>
  );
}
