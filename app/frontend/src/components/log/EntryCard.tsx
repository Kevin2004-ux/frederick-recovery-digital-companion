import { AlertTriangle, ClipboardList, Droplets, Flame, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { RecoveryLogEntry } from "@/types/log";

interface EntryCardProps {
  entry: RecoveryLogEntry | null;
  onEdit: () => void;
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{value}/10</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );
}

export function EntryCard({ entry, onEdit }: EntryCardProps) {
  if (!entry) {
    return (
      <Card className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <ClipboardList className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-950">No check-in for this date</h3>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Use the tracker to capture pain, swelling, and healing details in the existing backend format.
        </p>
        <Button className="mt-5" onClick={onEdit}>
          Add check-in
        </Button>
      </Card>
    );
  }

  const redFlagCount = entry.details.redFlags.length;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Saved check-in</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{entry.date}</h3>
        </div>
        <Button className="px-3 py-2" variant="secondary" onClick={onEdit}>
          <PencilLine className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Meter label="Pain level" tone="bg-rose-500" value={entry.painLevel} />
        <Meter label="Swelling level" tone="bg-sky-500" value={entry.swellingLevel} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <Droplets className="h-4 w-4 text-sky-600" />
            Wound observations
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Drainage: <span className="font-medium capitalize text-slate-900">{entry.details.drainageLevel}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Redness: <span className="font-medium capitalize text-slate-900">{entry.details.rednessLevel}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Warmth / odor:{" "}
            <span className="font-medium text-slate-900">
              {entry.details.warmth ? "Yes" : "No"} / {entry.details.odor ? "Yes" : "No"}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <Flame className="h-4 w-4 text-amber-600" />
            Activity & recovery
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Mobility: <span className="font-medium capitalize text-slate-900">{entry.details.mobility}</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Sleep: <span className="font-medium text-slate-900">{entry.details.sleepHours || "Not logged"} hours</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Water / meals:{" "}
            <span className="font-medium text-slate-900">
              {entry.details.waterCups || "0"} cups / {entry.details.meals || "0"} meals
            </span>
          </p>
        </div>
      </div>

      {redFlagCount > 0 ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-semibold text-red-800">Red flags were logged</p>
              <p className="mt-1 text-sm text-red-700">
                {redFlagCount} warning item{redFlagCount > 1 ? "s" : ""} captured in this check-in.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {entry.notes ? (
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{entry.notes}</p>
        </div>
      ) : null}
    </Card>
  );
}
