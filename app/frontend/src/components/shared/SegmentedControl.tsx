import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  label?: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="space-y-3">
      {label ? <div className="text-sm font-medium text-foreground">{label}</div> : null}
      <div className="inline-flex w-full rounded-2xl bg-stone-100 p-1">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                option.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
