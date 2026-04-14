import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Box,
  ExternalLink,
  Info,
  ShieldAlert,
} from "lucide-react";

import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BoxItem, MyBoxPayload } from "@/types";

type ItemLocationState = {
  itemKey?: string;
  itemLabel?: string;
  item?: BoxItem;
};

function buildDisplayItems(payload: MyBoxPayload | null): BoxItem[] {
  const richItems = payload?.myBox?.items ?? [];
  if (richItems.length > 0) return richItems;

  return (payload?.myBox?.includedItems ?? []).map((item) => ({
    key: item.key,
    label: item.label,
  }));
}

function firstParagraph(text?: string) {
  if (!text) return null;
  return text
    .split(/\n\s*\n|\n+/)
    .map((part) => part.trim())
    .find(Boolean) ?? null;
}

function remainingParagraphs(text?: string) {
  if (!text) return [];
  return text
    .split(/\n\s*\n|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(1);
}

function resolveRequestedIdentifier(
  params: Readonly<Partial<Record<string, string | undefined>>>,
  state: ItemLocationState | null
) {
  return (
    params.itemKey ??
    params.itemId ??
    params.id ??
    state?.itemKey ??
    state?.itemLabel ??
    null
  );
}

function normalizeIdentifier(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function itemRouteKey(item: Pick<BoxItem, "key" | "label">) {
  const raw = item.key?.trim() || item.label?.trim() || "item";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findItem(items: BoxItem[], identifier: string | null) {
  if (!identifier) return null;

  const normalized = normalizeIdentifier(identifier);
  return (
    items.find((item) => normalizeIdentifier(item.key) === normalized) ??
    items.find((item) => normalizeIdentifier(item.label) === normalized) ??
    items.find((item) => itemRouteKey(item) === normalized) ??
    null
  );
}

export default function MyBoxItemDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeState = (location.state ?? null) as ItemLocationState | null;
  const itemIdentifier = resolveRequestedIdentifier(params, routeState);
  const stateItem = routeState?.item ?? null;

  const [data, setData] = useState<MyBoxPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(itemIdentifier));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemIdentifier) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadMyBox() {
      setLoading(true);
      setError(null);

      try {
        const payload = await api<MyBoxPayload>("/activation/my-box", {
          method: "GET",
        });

        if (!active) return;
        setData(payload);
      } catch {
        if (!active) return;
        setError("We couldn’t load this recovery item right now.");
        setData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMyBox();

    return () => {
      active = false;
    };
  }, [itemIdentifier]);

  const liveItems = useMemo(() => buildDisplayItems(data), [data]);

  const item = useMemo(() => {
    const resolvedFromLiveData = findItem(liveItems, itemIdentifier);
    if (resolvedFromLiveData) return resolvedFromLiveData;

    if (!stateItem) return null;

    const stateCandidates = [
      stateItem,
      {
        ...stateItem,
        key: stateItem.key || routeState?.itemKey || routeState?.itemLabel || itemIdentifier || "item",
        label: stateItem.label || routeState?.itemLabel || stateItem.key || "Recovery item",
      },
    ];

    return (
      stateCandidates.find((candidate) => {
        const normalizedKey = normalizeIdentifier(candidate.key);
        const normalizedLabel = normalizeIdentifier(candidate.label);
        const routeKey = itemRouteKey(candidate);

        return (
          normalizedKey === normalizeIdentifier(itemIdentifier) ||
          normalizedLabel === normalizeIdentifier(itemIdentifier) ||
          routeKey === normalizeIdentifier(itemIdentifier)
        );
      }) ??
      stateCandidates[0]
    );
  }, [itemIdentifier, liveItems, routeState?.itemKey, routeState?.itemLabel, stateItem]);

  const summary = firstParagraph(item?.description) ?? firstParagraph(item?.education);
  const additionalGuidance = remainingParagraphs(item?.description ?? item?.education);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="h-9 self-start rounded-full px-3 text-muted-foreground"
          onClick={() => navigate("/my-box")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {item?.label ?? "Recovery item"}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            General usage guidance and supporting information for this recovery supply.
          </p>
        </div>
      </header>

      {loading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="h-4 w-24 rounded-full bg-stone-200/80" />
            <div className="h-8 w-52 rounded-full bg-stone-200/70" />
            <div className="h-4 w-full max-w-md rounded-full bg-stone-200/60" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-black/5 bg-stone-50/80 p-5"
                >
                  <div className="h-5 w-32 rounded-full bg-stone-200/70" />
                  <div className="mt-3 h-4 w-full rounded-full bg-stone-200/60" />
                  <div className="mt-2 h-4 w-4/5 rounded-full bg-stone-200/50" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : error ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to load this item
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => navigate("/my-box")}>
              Return to My Box
            </Button>
          </div>
        </Card>
      ) : !itemIdentifier ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
              <Box className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                No item selected
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Open an item from your recovery box to view its guidance here.
              </p>
            </div>
          </div>
        </Card>
      ) : !item ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
              <Box className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Item not found
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                This recovery item is not available in your current box details.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => navigate("/my-box")}>
              Return to My Box
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                  Recovery supply
                </p>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {item.label}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {summary ?? "Clinic-provided recovery supply with general usage guidance and support information."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start">
                {item.key ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    <Box className="h-4 w-4" />
                    {item.key}
                  </div>
                ) : null}
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                  <BadgeCheck className="h-4 w-4" />
                  Provided by clinic
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    What this item is for
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {summary ?? "Use the instructions from your clinic to understand how this item fits into your recovery plan."}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    How to use it
                  </h3>
                  {additionalGuidance.length > 0 ? (
                    <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                      {additionalGuidance.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Follow the instructions that came with your kit or the guidance from your clinic for day-to-day use.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Safety notes
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    This page provides general product guidance only. Follow your clinic’s instructions for how long to use this item and when to stop or change it.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    When to contact your clinic
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Contact your clinic if you are unsure how to use this item, if symptoms are changing, or if something about your recovery feels off or more painful than expected.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {item.educationUrl ? (
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-full px-5"
              onClick={() => window.open(item.educationUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              Open reference
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
