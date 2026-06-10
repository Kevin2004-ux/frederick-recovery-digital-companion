import type { ComponentType } from "react";
import {
  BookHeart,
  BookOpenText,
  Boxes,
  ClipboardPlus,
  PlayCircle,
  Sparkles,
} from "lucide-react";

import type { RecoveryLibraryCategoryKey } from "@/types";

type CategoryMeta = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  chipClassName: string;
  iconClassName: string;
  panelClassName: string;
};

export const RECOVERY_LIBRARY_CATEGORY_META: Record<
  RecoveryLibraryCategoryKey,
  CategoryMeta
> = {
  "start-here": {
    title: "Start Here",
    description: "Core first-step guides for the first stretch of recovery.",
    icon: Sparkles,
    chipClassName: "bg-emerald-50 text-emerald-900 border border-emerald-100",
    iconClassName: "bg-emerald-100 text-emerald-800",
    panelClassName: "from-emerald-100/80 via-white to-stone-50",
  },
  "common-recovery-topics": {
    title: "Common Recovery Topics",
    description: "Simple explanations for the questions patients ask most.",
    icon: BookOpenText,
    chipClassName: "bg-sky-50 text-sky-900 border border-sky-100",
    iconClassName: "bg-sky-100 text-sky-800",
    panelClassName: "from-sky-100/75 via-white to-stone-50",
  },
  "procedure-guides": {
    title: "Procedure Guides",
    description: "Procedure-based education that can follow the patient across tiers.",
    icon: ClipboardPlus,
    chipClassName: "bg-amber-50 text-amber-950 border border-amber-100",
    iconClassName: "bg-amber-100 text-amber-800",
    panelClassName: "from-amber-100/75 via-white to-stone-50",
  },
  "box-item-instructions": {
    title: "Box Item Instructions",
    description: "Recovery kit instructions tied to the supplies in the box.",
    icon: Boxes,
    chipClassName: "bg-violet-50 text-violet-950 border border-violet-100",
    iconClassName: "bg-violet-100 text-violet-800",
    panelClassName: "from-violet-100/75 via-white to-stone-50",
  },
  videos: {
    title: "Videos",
    description: "Visual walkthroughs for patients who would rather watch than read first.",
    icon: PlayCircle,
    chipClassName: "bg-rose-50 text-rose-950 border border-rose-100",
    iconClassName: "bg-rose-100 text-rose-800",
    panelClassName: "from-rose-100/75 via-white to-stone-50",
  },
  "clinic-instructions": {
    title: "Clinic Instructions",
    description: "Frederick Recovery guidance, reminders, and custom instructions.",
    icon: BookHeart,
    chipClassName: "bg-stone-100 text-stone-900 border border-stone-200",
    iconClassName: "bg-stone-200 text-stone-800",
    panelClassName: "from-stone-200/70 via-white to-stone-50",
  },
};

export function recoveryModuleTypeLabel(
  moduleType: "education" | "task" | "milestone"
) {
  switch (moduleType) {
    case "education":
      return "Guide";
    case "task":
      return "Instruction";
    case "milestone":
      return "Next step";
    default:
      return moduleType;
  }
}

export function recoveryVideoLabel(videoUrl: string | null | undefined) {
  if (!videoUrl) return "Watch video";

  try {
    const host = new URL(videoUrl).hostname.replace(/^www\./, "");
    if (host.includes("youtube")) return "Watch on YouTube";
    if (host.includes("vimeo")) return "Watch on Vimeo";
  } catch {
    return "Watch video";
  }

  return "Watch video";
}
