import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

type LogEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  schemaVersion: number;
  details?: Record<string, unknown>;
};

type WizardDetails = {
  painCompared?: "Better" | "Same" | "Worse" | "";
  swellingToday?: "None" | "Mild" | "Moderate" | "Severe" | "";
  swellingCompared?: "Better" | "Same" | "Worse" | "";

  movedAsRecommended?: "Yes" | "Somewhat" | "No" | "";
  difficultyActivities?: "None" | "Mild" | "Significant" | "";
  tookMeds?: "Yes" | "Missed one" | "Missed multiple" | "";
  sideEffects?: Array<"None" | "Nausea" | "Dizziness" | "Constipation" | "Other">;
  sideEffectsOtherText?: string;
  nonMedRelief?: Array<"Ice" | "Compression" | "Elevation" | "Rest" | "None">;

  siteChange?: "No" | "Slight" | "Significant" | "";
  drainage?: "None" | "Clear" | "Bloody" | "Yellow-green" | "";
  redFlags?: Array<
    "Fever" | "Shortness of breath" | "Chest pain" | "Severe swelling/pain" | "Sudden worsening" | "None"
  >;

  sleepHours?: string;
  sleepQuality?: "Poor" | "Fair" | "Good" | "Excellent" | "";
  eatNormally?: "Yes" | "Somewhat" | "No" | "";
  fluidIntake?: "Low" | "Adequate" | "High" | "";
  mood?: "Positive" | "Neutral" | "Low" | "";
  anxiety?: "Not at all" | "Somewhat" | "Very" | "";
  notes?: string; // wizard notes
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asDetails(details: unknown): WizardDetails | null {
  if (!isObject(details)) return null;
  return details as WizardDetails;
}

function cleanChoice(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s;
}

function formatList(v: unknown): string | null {
  if (!Array.isArray(v)) return null;
  const items = v.filter((x) => typeof x === "string") as string[];
  const filtered = items.filter((x) => x !== "None");
  if (filtered.length === 0) return null;
  return filtered.join(", ");
}

function badge(text: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral") {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-muted bg-muted/30 text-foreground";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function row(label: string, value: string | null) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}

export function DayEntrySummary(props: {
  selectedDate: string;
  entry: LogEntry | null;
  onEdit: (date: string) => void;
}) {
  const { selectedDate, entry, onEdit } = props;

  const [showFull, setShowFull] = useState(false);

  const details = useMemo(() => asDetails(entry?.details), [entry?.details]);

  const redFlags = useMemo(() => {
    if (!details) return [];
    const list = details.redFlags ?? [];
    const filtered = list.filter((x) => x && x !== "None");
    return filtered;
  }, [details]);

  const keySummary = useMemo(() => {
    if (!entry) return null;

    // Core always available:
    const pain = `${entry.painLevel}/10`;
    const swelling = `${entry.swellingLevel}/10`;

    // Enhanced v2 if present:
    const painCompared = cleanChoice(details?.painCompared);
    const swellingToday = cleanChoice(details?.swellingToday);
    const swellingCompared = cleanChoice(details?.swellingCompared);

    const moved = cleanChoice(details?.movedAsRecommended);
    const meds = cleanChoice(details?.tookMeds);
    const activity = cleanChoice(details?.difficultyActivities);

    const siteChange = cleanChoice(details?.siteChange);
    const drainage = cleanChoice(details?.drainage);

    const sleepHours = cleanChoice(details?.sleepHours);
    const sleepQuality = cleanChoice(details?.sleepQuality);
    const eat = cleanChoice(details?.eatNormally);
    const fluids = cleanChoice(details?.fluidIntake);
    const mood = cleanChoice(details?.mood);
    const anxiety = cleanChoice(details?.anxiety);

    const sideEffects = formatList(details?.sideEffects);
    const sideEffectsOther =
      sideEffects && sideEffects.includes("Other") ? cleanChoice(details?.sideEffectsOtherText) : null;

    const nonMed = formatList(details?.nonMedRelief);

    // Notes preference: entry.notes (top-level) first, else wizard notes
    const notes = entry.notes?.trim() ? entry.notes.trim() : cleanChoice(details?.notes);

    return {
      pain,
      swelling,
      painCompared,
      swellingToday,
      swellingCompared,
      moved,
      meds,
      activity,
      sideEffects,
      sideEffectsOther,
      nonMed,
      siteChange,
      drainage,
      sleepHours,
      sleepQuality,
      eat,
      fluids,
      mood,
      anxiety,
      notes,
    };
  }, [entry, details]);

  if (!entry) {
    return (
      <Card className="rounded-2xl p-5 shadow-sm">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Selected day</div>
          <div className="text-lg font-semibold">{selectedDate}</div>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          No check-in saved for this day.
        </div>

        <Button
          className="mt-4 w-full rounded-xl"
          variant="outline"
          onClick={() => onEdit(selectedDate)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Add check-in for this day
        </Button>
      </Card>
    );
  }

  const hasAnyRedFlag = redFlags.length > 0;

  return (
    <Card className="rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Selected day</div>
          <div className="text-lg font-semibold">{entry.date}</div>
          <div className="text-xs text-muted-foreground">Entry v{entry.schemaVersion}</div>
        </div>

        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => onEdit(entry.date)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <Separator className="my-4" />

      {/* SUMMARY */}
      <div className="space-y-3">
        <div className="text-sm font-semibold">Summary</div>

        <div className="flex flex-wrap gap-2">
          {badge(`Pain ${keySummary?.pain ?? ""}`, "neutral")}
          {badge(`Swelling ${keySummary?.swelling ?? ""}`, "neutral")}
          {keySummary?.painCompared ? badge(`Pain: ${keySummary.painCompared}`, "neutral") : null}
          {keySummary?.swellingToday ? badge(`Swelling: ${keySummary.swellingToday}`, "neutral") : null}
        </div>

        {hasAnyRedFlag ? (
          <Alert className="rounded-xl">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-red-700">Red flags noted</div>
              <div className="flex flex-wrap gap-2">
                {redFlags.map((f) => (
                  <span key={f} className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-800">
                    {f}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                This app does not provide medical advice. If symptoms are severe or worsening, contact your surgeon/clinic.
              </div>
            </div>
          </Alert>
        ) : (
          <div className="text-sm text-muted-foreground">
            Red flags: <span className="text-foreground font-medium">None reported</span>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      {/* KEY DETAILS (human readable, minimal scrolling) */}
      <div className="space-y-3">
        <div className="text-sm font-semibold">Key details</div>

        <div className="space-y-2">
          {row("Mobility", keySummary?.moved ? `Moved as recommended: ${keySummary.moved}` : null)}
          {row("Activities", keySummary?.activity ? `Difficulty: ${keySummary.activity}` : null)}
          {row("Medication", keySummary?.meds ? `Took meds: ${keySummary.meds}` : null)}
          {row("Side effects", keySummary?.sideEffects ? keySummary.sideEffects : null)}
          {row("Other side effect", keySummary?.sideEffectsOther ? keySummary.sideEffectsOther : null)}
          {row("Non-med relief", keySummary?.nonMed ? keySummary.nonMed : null)}
        </div>

        <div className="space-y-2">
          {row("Wound / site", keySummary?.siteChange ? `Change vs yesterday: ${keySummary.siteChange}` : null)}
          {row("Drainage", keySummary?.drainage ? keySummary.drainage : null)}
        </div>

        <div className="space-y-2">
  {row("Sleep", keySummary?.sleepHours ? `${keySummary.sleepHours} hours` : null)}
  {row("Sleep quality", keySummary?.sleepQuality ?? null)}
  {row("Appetite", keySummary?.eat ? `Eating normally: ${keySummary.eat}` : null)}
  {row("Fluids", keySummary?.fluids ?? null)}
  {row("Mood", keySummary?.mood ?? null)}
  {row("Anxiety", keySummary?.anxiety ?? null)}
</div>


        {keySummary?.notes ? (
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="text-xs font-semibold text-muted-foreground">Notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{keySummary.notes}</div>
          </div>
        ) : null}
      </div>

      {/* FULL DETAILS TOGGLE */}
      <div className="mt-5">
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => setShowFull((s) => !s)}
        >
          {showFull ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Hide full details
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              View full details
            </>
          )}
        </Button>

        {showFull ? (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-semibold">Full details (exact selections)</div>

            {!details ? (
              <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                No detailed wizard data saved for this entry (v1 snapshot only).
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Pain & swelling</div>
                  <div className="mt-2 space-y-2">
                    {row("Pain compared", cleanChoice(details.painCompared))}
                    {row("Swelling today", cleanChoice(details.swellingToday))}
                    {row("Swelling compared", cleanChoice(details.swellingCompared))}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Mobility & medications</div>
                  <div className="mt-2 space-y-2">
                    {row("Moved as recommended", cleanChoice(details.movedAsRecommended))}
                    {row("Difficulty with activities", cleanChoice(details.difficultyActivities))}
                    {row("Took meds", cleanChoice(details.tookMeds))}
                    {row("Side effects", formatList(details.sideEffects))}
                    {row("Other side effect", cleanChoice(details.sideEffectsOtherText))}
                    {row("Non-med relief", formatList(details.nonMedRelief))}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Wound & safety</div>
                  <div className="mt-2 space-y-2">
                    {row("Site change", cleanChoice(details.siteChange))}
                    {row("Drainage", cleanChoice(details.drainage))}
                    {row("Red flags", formatList(details.redFlags))}
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Sleep, nutrition & mood</div>
                  <div className="mt-2 space-y-2">
                    {row("Sleep hours", cleanChoice(details.sleepHours))}
                    {row("Sleep quality", cleanChoice(details.sleepQuality))}
                    {row("Eating normally", cleanChoice(details.eatNormally))}
                    {row("Fluid intake", cleanChoice(details.fluidIntake))}
                    {row("Mood", cleanChoice(details.mood))}
                    {row("Anxiety", cleanChoice(details.anxiety))}
                  </div>
                </div>

                {/* Optional: raw JSON for debugging */}
                <div className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-muted-foreground">Raw data (for reference)</div>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-muted/30 p-3 text-xs">
                    {JSON.stringify(details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
