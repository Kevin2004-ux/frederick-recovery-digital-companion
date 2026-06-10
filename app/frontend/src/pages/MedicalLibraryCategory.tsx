import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "@/api/client";
import { RecoveryGuideCard } from "@/components/library/RecoveryGuideCard";
import { RECOVERY_LIBRARY_CATEGORY_META } from "@/components/library/recoveryLibraryMeta";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RecoveryLibraryCategoryPayload } from "@/types";

export default function MedicalLibraryCategory() {
  const navigate = useNavigate();
  const { categoryKey } = useParams<{ categoryKey: string }>();
  const [payload, setPayload] = useState<RecoveryLibraryCategoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCategory() {
      if (!categoryKey) {
        setError("Category not found.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await api<RecoveryLibraryCategoryPayload>(
          `/education/library/categories/${categoryKey}`,
          { method: "GET" }
        );

        if (!active) return;
        setPayload(response);
      } catch {
        if (!active) return;
        setPayload(null);
        setError("We couldn’t load that library category right now.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCategory();

    return () => {
      active = false;
    };
  }, [categoryKey]);

  const categoryMeta =
    payload?.category ? RECOVERY_LIBRARY_CATEGORY_META[payload.category.key] : null;
  const Icon = categoryMeta?.icon;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-full px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-900"
            onClick={() => navigate("/medical-hub")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Button>
        </div>

        {categoryMeta && Icon ? (
          <Card className="rounded-[32px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${categoryMeta.iconClassName}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${categoryMeta.chipClassName}`}>
                    {payload?.category.title}
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {payload?.category.title}
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                    {payload?.category.description}
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-700">
                {payload?.guides.length ?? 0} guides
              </div>
            </div>
          </Card>
        ) : null}
      </header>

      {loading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Loading category guides
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Pulling guides for this part of the recovery library.
              </p>
            </div>
          </div>
        </Card>
      ) : error ? (
        <Card className="rounded-[30px] border border-rose-200 bg-rose-50/70 p-5 text-sm leading-6 text-rose-950 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
          {error}
        </Card>
      ) : payload?.guides.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payload.guides.map((guide) => (
            <RecoveryGuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      ) : (
        <Card className="rounded-[30px] border border-dashed border-black/10 bg-white/85 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.03)] sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              No guides here yet
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Frederick Recovery can add or activate guides for this category from the internal
              library admin.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
