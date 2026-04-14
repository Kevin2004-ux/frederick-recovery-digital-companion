import { useState } from "react";
import { Frown, Loader2, Meh, Smile, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type QuickCheckInState = "good" | "fair" | "poor";

type QuickCheckInProps = {
  loadingState?: QuickCheckInState | null;
  onQuickLog: (state: QuickCheckInState) => Promise<void>;
  onGoToFullLog: () => void;
  onDismiss: () => void;
  className?: string;
};

const OPTIONS: Array<{
  value: QuickCheckInState;
  label: string;
  subtitle: string;
  icon: typeof Smile;
}> = [
  {
    value: "good",
    label: "Good",
    subtitle: "Managing well",
    icon: Smile,
  },
  {
    value: "fair",
    label: "Okay",
    subtitle: "A few issues",
    icon: Meh,
  },
  {
    value: "poor",
    label: "Tough",
    subtitle: "Need closer attention",
    icon: Frown,
  },
];

export function QuickCheckIn({
  loadingState,
  onQuickLog,
  onGoToFullLog,
  onDismiss,
  className,
}: QuickCheckInProps) {
  const [pendingState, setPendingState] = useState<QuickCheckInState | null>(null);

  const activeLoadingState = loadingState ?? pendingState;
  const isBusy = activeLoadingState !== null;

  async function handleQuickLog(state: QuickCheckInState) {
    if (isBusy) return;

    if (loadingState === undefined) {
      setPendingState(state);
    }

    try {
      await onQuickLog(state);
    } finally {
      if (loadingState === undefined) {
        setPendingState(null);
      }
    }
  }

  return (
    <Card
      className={cn(
        "w-full rounded-[28px] border-black/5 bg-white/95 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            How are you feeling today?
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Log a quick baseline now, or open the full daily report for more detail.
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          disabled={isBusy}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Dismiss quick check-in"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isLoading = activeLoadingState === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => void handleQuickLog(option.value)}
              disabled={isBusy}
              className={cn(
                "flex min-h-[124px] flex-col items-start justify-between rounded-2xl border border-black/5 bg-stone-50/70 p-4 text-left transition-all",
                "hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-70"
              )}
              aria-busy={isLoading}
            >
              <div
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
                  option.value === "good" && "bg-emerald-50 text-emerald-700",
                  option.value === "fair" && "bg-amber-50 text-amber-700",
                  option.value === "poor" && "bg-rose-50 text-rose-700"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground sm:text-base">
                  {option.label}
                </div>
                <div className="text-xs leading-5 text-muted-foreground sm:text-sm">
                  {isLoading ? "Saving..." : option.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={onGoToFullLog}
        disabled={isBusy}
        className="mt-4 w-full sm:mt-5"
      >
        Fill out full daily report
      </Button>
    </Card>
  );
}
