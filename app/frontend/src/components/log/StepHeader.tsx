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
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground">
          Step {step} of {total}
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>

      <Button variant="outline" className="rounded-xl" onClick={onCancel}>
        <X className="mr-2 h-4 w-4" />
        Close
      </Button>
    </div>
  );
}
