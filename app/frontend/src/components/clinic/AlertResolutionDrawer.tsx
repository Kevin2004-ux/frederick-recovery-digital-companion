import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { OperationalAlert } from "@/types";

type ResolutionAction =
  | "called-patient"
  | "left-voicemail"
  | "adjusted-plan"
  | "monitored";

type AlertResolutionDrawerProps = {
  open: boolean;
  alert?: OperationalAlert | null;
  patientName?: string | null;
  onClose: () => void;
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value : null;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function AlertResolutionDrawer({
  open,
  alert,
  patientName,
  onClose,
}: AlertResolutionDrawerProps) {
  const [action, setAction] = useState<ResolutionAction | "">("");
  const [note, setNote] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setAction("");
      setNote("");
      setInfoMessage(null);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = action !== "" && note.trim().length > 0;
  const alertSummary =
    alert?.summary?.trim() || alert?.reasons?.[0] || "Open recovery alert";
  const sectionClass = "rounded-[24px] border border-black/5 bg-stone-50/80 p-4 sm:p-5";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close alert resolution drawer"
        className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-[36rem] flex-col overflow-hidden border-l border-black/8 bg-white shadow-[-32px_0_80px_rgba(15,23,42,0.18)] sm:rounded-l-[32px]"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-black/6 bg-stone-50/70 px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-rose-700">
              Alert workflow
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Resolve Alert
            </h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Document the follow-up step for {patientName || "this patient"} without closing the chart.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-black/5 bg-white/90 text-muted-foreground hover:bg-stone-100"
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <div className="rounded-[24px] border border-rose-100 bg-rose-50/55 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/90 text-rose-700 ring-1 ring-rose-100">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {alert?.severity?.trim() || "Alert"}
                </div>
                <p className="break-words text-sm leading-6 text-muted-foreground">{alertSummary}</p>
                {alert?.triggeredAt ? (
                  <div className="text-xs text-muted-foreground">
                    Triggered {formatDateTime(alert.triggeredAt)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <SegmentedControl
              label="Resolution action"
              value={action}
              onChange={(value) => {
                setAction(value);
                setInfoMessage(null);
              }}
              options={[
                { label: "Called Patient", value: "called-patient" },
                { label: "Left Voicemail", value: "left-voicemail" },
                { label: "Adjusted Plan", value: "adjusted-plan" },
                { label: "Monitored", value: "monitored" },
              ]}
            />
          </div>

          <div className={sectionClass}>
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Clinical note
              </label>
              <Textarea
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  setInfoMessage(null);
                }}
                placeholder="E.g., Spoke with patient. Reviewed symptoms and advised next steps."
                className="min-h-[176px] rounded-[20px] border-black/8 bg-white px-4 py-3 text-[15px] shadow-none focus-visible:ring-emerald-600"
              />
            </div>
          </div>

          <div
            className={cn(
              "rounded-[24px] border border-dashed border-black/10 bg-white/80 p-4 text-sm leading-6 text-muted-foreground sm:p-5"
            )}
          >
            {infoMessage
              ? infoMessage
              : "This drawer sets up the clinic resolution workflow. Saving the resolution comes in the next step."}
          </div>
        </div>

        <div className="shrink-0 border-t border-black/6 bg-white/96 px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto sm:min-w-[120px]"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto sm:min-w-[170px]"
              disabled={!canSubmit}
              onClick={() =>
                setInfoMessage("Resolution workflow wiring comes in the next step.")
              }
            >
              Mark as Resolved
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
