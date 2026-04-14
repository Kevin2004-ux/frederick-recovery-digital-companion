import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

type LogEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  schemaVersion: number;
  details?: Record<string, unknown>;
};

type ApprovedDetails = {
  medicationStatus?: "took_it" | "missed_dose";
  redFlags?: string[];
  sideEffectsOrConcerns?: string;
  drainage?: "none" | "light" | "moderate" | "heavy";
  rednessAroundIncision?: "none" | "mild" | "moderate" | "severe";
  warmthAroundWound?: "yes" | "no";
  unusualOdor?: "yes" | "no";
  mobility?: "normal" | "limited" | "bedrest";
  tookMeds?: "Yes" | "Missed one" | "Missed multiple" | "";
  sideEffects?: string[];
  sideEffectsOtherText?: string;
  drainageLegacy?: string;
  siteChange?: string;
  movedAsRecommended?: string;
  difficultyActivities?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asDetails(details: unknown): ApprovedDetails | null {
  if (!isObject(details)) return null;
  return details as ApprovedDetails;
}

function cleanChoice(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function formatChoice(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function row(label: string, value: string | null) {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-white/70 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground sm:text-right">{value}</div>
    </div>
  );
}

function mapMedication(details: ApprovedDetails | null) {
  if (!details) return null;

  if (details.medicationStatus === "missed_dose") return "Missed a dose";
  if (details.medicationStatus === "took_it") return "Took it";

  if (details.tookMeds === "Missed one" || details.tookMeds === "Missed multiple") {
    return "Missed a dose";
  }
  if (details.tookMeds === "Yes") return "Took it";

  return null;
}

function mapMobility(details: ApprovedDetails | null) {
  if (!details) return null;
  if (details.mobility) return formatChoice(details.mobility);

  if (details.movedAsRecommended === "No" || details.difficultyActivities === "Significant") {
    return "Bedrest";
  }
  if (
    details.movedAsRecommended === "Somewhat" ||
    details.difficultyActivities === "Mild"
  ) {
    return "Limited";
  }
  if (details.movedAsRecommended === "Yes" || details.difficultyActivities === "None") {
    return "Normal";
  }

  return null;
}

function mapDrainage(details: ApprovedDetails | null) {
  if (!details) return null;
  if (details.drainage) return formatChoice(details.drainage);

  const legacy = cleanChoice(details.drainageLegacy ?? details["drainage"]);
  if (!legacy) return null;
  if (legacy === "Clear") return "Light";
  if (legacy === "Bloody" || legacy === "Yellow-green") return "Moderate";
  return legacy;
}

function mapRedness(details: ApprovedDetails | null) {
  if (!details) return null;
  if (details.rednessAroundIncision) return formatChoice(details.rednessAroundIncision);

  const siteChange = cleanChoice(details.siteChange);
  if (siteChange === "No") return "None";
  if (siteChange === "Slight") return "Mild";
  if (siteChange === "Significant") return "Severe";

  return null;
}

function mapYesNo(value: unknown) {
  const choice = cleanChoice(value);
  if (choice === "yes" || choice === "Yes") return "Yes";
  if (choice === "no" || choice === "No") return "No";
  return null;
}

function mapConcerns(details: ApprovedDetails | null) {
  if (!details) return null;

  const direct = cleanChoice(details.sideEffectsOrConcerns);
  if (direct) return direct;

  const legacyOther = cleanChoice(details.sideEffectsOtherText);
  if (legacyOther) return legacyOther;

  if (Array.isArray(details.sideEffects)) {
    const values = details.sideEffects.filter(
      (item) => typeof item === "string" && item !== "None" && item !== "Other"
    );
    return values.length > 0 ? values.join(", ") : null;
  }

  return null;
}

function mapRedFlags(details: ApprovedDetails | null) {
  if (!details?.redFlags || !Array.isArray(details.redFlags)) return [];

  const mapped = details.redFlags.flatMap((item) => {
    const normalized = item.trim().toLowerCase();

    if (!normalized || normalized === "none") return [];
    if (normalized === "fever_over_101" || normalized === "fever") {
      return ["Fever over 101°F"];
    }
    if (
      normalized === "pain_getting_worse" ||
      normalized === "sudden worsening" ||
      normalized === "severe swelling/pain"
    ) {
      return ["Pain getting worse"];
    }
    if (normalized === "redness_spreading") {
      return ["Redness spreading"];
    }
    if (
      normalized === "chest_pain_breathing" ||
      normalized === "chest pain" ||
      normalized === "shortness of breath"
    ) {
      return ["Chest pain / trouble breathing"];
    }

    return [formatChoice(item)];
  });

  return Array.from(new Set(mapped));
}

export function DayEntrySummary(props: {
  selectedDate: string;
  entry: LogEntry | null;
  onEdit: (date: string) => void;
}) {
  const { selectedDate, entry, onEdit } = props;

  const [showFull, setShowFull] = useState(false);

  const details = useMemo(() => asDetails(entry?.details), [entry?.details]);
  const redFlags = useMemo(() => mapRedFlags(details), [details]);

  const summary = useMemo(() => {
    if (!entry) return null;

    return {
      medication: mapMedication(details),
      concerns: mapConcerns(details),
      mobility: mapMobility(details),
      drainage: mapDrainage(details),
      redness: mapRedness(details),
      warmth: mapYesNo(details?.warmthAroundWound),
      odor: mapYesNo(details?.unusualOdor),
      notes: entry.notes?.trim() || null,
    };
  }, [details, entry]);

  if (!entry) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Selected date</div>
          <div className="text-lg font-semibold tracking-tight">{selectedDate}</div>
        </div>

        <div className="mt-4 rounded-2xl bg-stone-50/80 p-4 text-sm text-muted-foreground">
          No check-in saved for this day.
        </div>

        <Button
          className="mt-4 w-full rounded-full"
          variant="outline"
          onClick={() => onEdit(selectedDate)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Add check-in
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Selected date</div>
          <div className="text-lg font-semibold tracking-tight">{entry.date}</div>
          <div className="text-xs text-muted-foreground">Saved entry</div>
        </div>

        <Button
          variant="ghost"
          className="self-start rounded-full px-3 text-muted-foreground sm:self-auto"
          onClick={() => onEdit(entry.date)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        <div className="text-sm font-semibold tracking-tight">Summary</div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-muted bg-muted/30 px-2.5 py-1 text-xs text-foreground">
            Pain {entry.painLevel}/10
          </span>
          <span className="inline-flex items-center rounded-full border border-muted bg-muted/30 px-2.5 py-1 text-xs text-foreground">
            Swelling {entry.swellingLevel}/10
          </span>
          {summary?.medication ? (
            <span className="inline-flex items-center rounded-full border border-muted bg-muted/30 px-2.5 py-1 text-xs text-foreground">
              Medication: {summary.medication}
            </span>
          ) : null}
        </div>

        {redFlags.length > 0 ? (
          <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-950">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-amber-950">
                Warning signs reported
              </div>
              <div className="flex flex-wrap gap-2">
                {redFlags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-flex rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 text-xs text-amber-900"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </Alert>
        ) : (
          <div className="text-sm text-muted-foreground">
            Warning signs: <span className="font-medium text-foreground">None noted</span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div className="text-sm font-semibold tracking-tight">Day summary</div>

        <div className="space-y-2 rounded-2xl bg-stone-50/80 p-3 sm:p-4">
          {row("Medication", summary?.medication ?? null)}
          {row("Concerns", summary?.concerns ?? null)}
          {row("Mobility", summary?.mobility ?? null)}
        </div>

        <div className="space-y-2 rounded-2xl bg-stone-50/80 p-3 sm:p-4">
          {row("Drainage", summary?.drainage ?? null)}
          {row("Redness around incision", summary?.redness ?? null)}
          {row("Warmth around wound", summary?.warmth ?? null)}
          {row("Unusual odor", summary?.odor ?? null)}
        </div>

        {summary?.notes ? (
          <div className="rounded-2xl bg-stone-50/80 p-4 sm:p-5">
            <div className="text-xs font-semibold text-muted-foreground">Additional notes</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {summary.notes}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <Button
          variant="ghost"
          className="w-full rounded-full text-muted-foreground"
          onClick={() => setShowFull((open) => !open)}
        >
          {showFull ? (
            <>
              <ChevronUp className="mr-2 h-4 w-4" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="mr-2 h-4 w-4" />
              View details
            </>
          )}
        </Button>

        {showFull ? (
          <div className="mt-4 space-y-4">
            <div className="text-sm font-semibold tracking-tight">More details</div>

            {!details ? (
              <div className="rounded-2xl bg-stone-50/80 p-4 text-sm text-muted-foreground">
                No additional details were saved for this check-in.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl bg-stone-50/80 p-4 sm:p-5">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Medication & concerns
                  </div>
                  <div className="mt-2 space-y-2">
                    {row("Medication", summary?.medication ?? null)}
                    {row("Concerns", summary?.concerns ?? null)}
                  </div>
                </div>

                <div className="rounded-2xl bg-stone-50/80 p-4 sm:p-5">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Incision / wound
                  </div>
                  <div className="mt-2 space-y-2">
                    {row("Drainage", summary?.drainage ?? null)}
                    {row("Redness around incision", summary?.redness ?? null)}
                    {row("Warmth around wound", summary?.warmth ?? null)}
                    {row("Unusual odor", summary?.odor ?? null)}
                  </div>
                </div>

                <div className="rounded-2xl bg-stone-50/80 p-4 sm:p-5">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Mobility & warning signs
                  </div>
                  <div className="mt-2 space-y-2">
                    {row("Mobility", summary?.mobility ?? null)}
                    {row("Warning signs", redFlags.length > 0 ? redFlags.join(", ") : null)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
