import { cn } from "@/lib/utils";

type LevelSliderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  hint?: string;
  onChange: (value: number) => void;
};

function toneClass(value: number, max: number) {
  const ratio = max <= 0 ? 0 : value / max;
  if (ratio >= 0.8) return "text-red-700 bg-red-50";
  if (ratio >= 0.5) return "text-amber-800 bg-amber-50";
  return "text-emerald-700 bg-emerald-50";
}

export function LevelSlider({
  label,
  value,
  min = 0,
  max = 10,
  step = 1,
  disabled = false,
  hint,
  onChange,
}: LevelSliderProps) {
  return (
    <div className="space-y-3 rounded-2xl bg-stone-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <div
          className={cn(
            "inline-flex min-w-12 items-center justify-center rounded-full px-2.5 py-1 text-sm font-medium",
            toneClass(value, max)
          )}
        >
          {value}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-60"
      />

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
