import { ArrowLeft, Loader2, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "@/api/client";
import { RecoveryGuideCard } from "@/components/library/RecoveryGuideCard";
import {
  RECOVERY_LIBRARY_CATEGORY_META,
  recoveryModuleTypeLabel,
  recoveryVideoLabel,
} from "@/components/library/recoveryLibraryMeta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RecoveryLibraryGuidePayload } from "@/types";

export default function MedicalLibraryGuide() {
  const navigate = useNavigate();
  const { guideId } = useParams<{ guideId: string }>();
  const [payload, setPayload] = useState<RecoveryLibraryGuidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadGuide() {
      if (!guideId) {
        setError("Guide not found.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api<RecoveryLibraryGuidePayload>(
          `/education/library/guides/${guideId}`,
          { method: "GET" }
        );

        if (!active) return;
        setPayload(response);
      } catch {
        if (!active) return;
        setPayload(null);
        setError("We couldn’t load that guide right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadGuide();

    return () => {
      active = false;
    };
  }, [guideId]);

  const guide = payload?.guide;
  const primaryCategory =
    guide?.categories[0] ?? "common-recovery-topics";
  const categoryMeta = RECOVERY_LIBRARY_CATEGORY_META[primaryCategory];
  const Icon = categoryMeta.icon;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-900"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      {loading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Loading guide
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Pulling the full Frederick Recovery guide details now.
              </p>
            </div>
          </div>
        </Card>
      ) : error || !guide ? (
        <Card className="rounded-[30px] border border-rose-200 bg-rose-50/70 p-5 text-sm leading-6 text-rose-950 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          {error || "Guide not found."}
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden rounded-[34px] border border-black/5 bg-white/95 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_32%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.96))] p-5 sm:p-7">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${categoryMeta.chipClassName}`}>
                      {categoryMeta.title}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-stone-700">
                      {recoveryModuleTypeLabel(guide.type)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                      {guide.title}
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                      {guide.summary}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {guide.procedureNames.map((procedure) => (
                      <span
                        key={procedure}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-950"
                      >
                        {procedure}
                      </span>
                    ))}
                    {guide.boxItemKeys.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-950"
                      >
                        {item}
                      </span>
                    ))}
                    {guide.requiredBoxItems.map((item) => (
                      <span
                        key={`required-${item}`}
                        className="rounded-full border border-stone-200 bg-stone-100 px-3 py-1.5 text-sm text-stone-700"
                      >
                        helpful: {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-black/5 bg-stone-50/70 p-5 sm:p-7 lg:border-l lg:border-t-0">
                {guide.thumbnailUrl ? (
                  <img
                    src={guide.thumbnailUrl}
                    alt={guide.title}
                    className="h-60 w-full rounded-[24px] object-cover"
                  />
                ) : (
                  <div className={`flex h-60 items-end rounded-[24px] bg-gradient-to-br ${categoryMeta.panelClassName} p-5`}>
                    <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${categoryMeta.iconClassName}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                )}

                {guide.videoUrl ? (
                  <a
                    href={guide.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {recoveryVideoLabel(guide.videoUrl)}
                  </a>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="space-y-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Guide details
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    The full Frederick Recovery guide content for this topic.
                  </p>
                </div>

                <div className="space-y-4">
                  {guide.paragraphs.map((paragraph, index) => (
                    <p key={index} className="text-sm leading-7 text-foreground/90">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              {guide.keyPoints.length > 0 ? (
                <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Key points
                    </h2>
                    <ul className="space-y-2">
                      {guide.keyPoints.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"
                        >
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ) : null}

              {guide.redFlags.length > 0 ? (
                <Card className="rounded-[30px] border border-amber-200 bg-amber-50/75 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold tracking-tight text-amber-950">
                      When to contact your clinic
                    </h2>
                    <ul className="space-y-2">
                      {guide.redFlags.map((flag) => (
                        <li
                          key={flag}
                          className="flex items-start gap-2 text-sm leading-6 text-amber-950/90"
                        >
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500/90" />
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              ) : null}

              {guide.frequency ? (
                <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Timing
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {guide.frequency}
                    </p>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>

          {payload.relatedGuides.length > 0 ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Related guides
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Nearby topics from the same recovery library.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {payload.relatedGuides.map((relatedGuide) => (
                  <RecoveryGuideCard key={relatedGuide.id} guide={relatedGuide} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
