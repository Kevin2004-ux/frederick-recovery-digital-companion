import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type MedCardProps = {
  title: string;
  subtitle?: string;
  status?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function MedCard({
  title,
  subtitle,
  status,
  selected = false,
  disabled = false,
  onClick,
}: MedCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition-colors",
        selected
          ? "border-emerald-200 bg-emerald-50"
          : "border-black/6 bg-white hover:bg-stone-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {subtitle ? (
            <div className="text-sm leading-6 text-muted-foreground">{subtitle}</div>
          ) : null}
          {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
        </div>

        <div
          className={cn(
            "rounded-full p-1.5",
            selected ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-400"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}
