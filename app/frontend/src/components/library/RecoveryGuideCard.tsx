import { ArrowRight, PlayCircle, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";

import {
  RECOVERY_LIBRARY_CATEGORY_META,
  recoveryModuleTypeLabel,
} from "@/components/library/recoveryLibraryMeta";
import { Card } from "@/components/ui/card";
import type { RecoveryLibraryGuideSummary } from "@/types";

type RecoveryGuideCardProps = {
  guide: RecoveryLibraryGuideSummary;
};

function firstCategory(guide: RecoveryLibraryGuideSummary) {
  return guide.categories[0] ?? "common-recovery-topics";
}

export function RecoveryGuideCard({ guide }: RecoveryGuideCardProps) {
  const categoryMeta = RECOVERY_LIBRARY_CATEGORY_META[firstCategory(guide)];
  const Icon = categoryMeta.icon;

  return (
    <Link to={`/medical-hub/guides/${guide.id}`} className="block">
      <Card className="group h-full rounded-[28px] border border-black/5 bg-white/95 p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] transition-transform duration-150 hover:-translate-y-0.5 sm:p-5">
        <div className="flex h-full flex-col gap-4">
          <div
            className={`rounded-[24px] bg-gradient-to-br ${categoryMeta.panelClassName} p-4`}
          >
            {guide.thumbnailUrl ? (
              <img
                src={guide.thumbnailUrl}
                alt={guide.title}
                className="h-36 w-full rounded-[18px] object-cover"
              />
            ) : (
              <div className="flex h-36 items-end justify-between rounded-[18px] border border-white/60 bg-white/70 p-4">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${categoryMeta.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </div>
                {guide.videoUrl ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Video
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${categoryMeta.chipClassName}`}
              >
                {categoryMeta.title}
              </span>
              <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-stone-700">
                {recoveryModuleTypeLabel(guide.type)}
              </span>
              {guide.featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-950">
                  <Star className="h-3 w-3" />
                  Starred
                </span>
              ) : null}
              {guide.recommended && !guide.featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-950">
                  <Sparkles className="h-3 w-3" />
                  Recommended
                </span>
              ) : null}
              {guide.recommendationLabel ? (
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-foreground ring-1 ring-black/8">
                  {guide.recommendationLabel}
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {guide.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {guide.summary}
              </p>
            </div>
          </div>

          <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-emerald-900">
            Open guide
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
