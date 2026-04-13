import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Props = {
  step: number; // 1..4
  total: number; // 4
  title: string;
  onCancel: () => void;
};

export function StepHeader({ step, total, title, onCancel }: Props) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
          Step {step} of {total}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
      </div>

      <Button
        variant="ghost"
        className="h-9 rounded-full px-3 text-muted-foreground"
        onClick={onCancel}
      >
        <X className="mr-2 h-4 w-4" />
        Close
      </Button>
    </div>
  );
}
