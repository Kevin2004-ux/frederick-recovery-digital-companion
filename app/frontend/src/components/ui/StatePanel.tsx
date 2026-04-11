import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface StatePanelProps {
  title: string;
  description: string;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
  action?: ReactNode;
}

const toneClasses = {
  neutral: "border-slate-100 bg-slate-50/85 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
};

export function StatePanel({
  title,
  description,
  icon,
  tone = "neutral",
  className,
  action,
}: StatePanelProps) {
  return (
    <div className={cn("state-panel", toneClasses[tone], className)}>
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-7 opacity-90">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
