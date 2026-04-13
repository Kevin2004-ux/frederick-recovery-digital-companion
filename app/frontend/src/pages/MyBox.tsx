import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Box,
  PackageCheck,
} from "lucide-react";

import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BoxItem, MyBoxPayload } from "@/types";

function itemRouteKey(item: Pick<BoxItem, "key" | "label">) {
  const raw = item.key?.trim() || item.label?.trim() || "item";
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceBadgeText(source: MyBoxPayload["source"]) {
  if (source?.batchLinked) return "Verified kit";
  if (source?.activationStatus) return "Assigned kit";
  return "Recovery kit";
}

function buildDisplayItems(payload: MyBoxPayload | null): BoxItem[] {
  const richItems = payload?.myBox?.items ?? [];
  if (richItems.length > 0) return richItems;

  return (payload?.myBox?.includedItems ?? []).map((item) => ({
    key: item.key,
    label: item.label,
  }));
}

export default function MyBox() {
  const navigate = useNavigate();
  const [data, setData] = useState<MyBoxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        setError("We couldn’t load your recovery box right now.");
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
  }, []);

  const items = useMemo(() => buildDisplayItems(data), [data]);
  const boxType = data?.myBox?.boxType?.trim() || "Recovery kit";
  const hasBox = Boolean(data?.myBox);

  return (
    <div className="mx-auto w-full space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="h-9 self-start rounded-full px-3 text-muted-foreground"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            My Recovery Box
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Review your clinic-provided recovery supplies and any instructions included with your kit.
          </p>
        </div>
      </header>

      {loading ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="h-4 w-28 rounded-full bg-stone-200/80" />
            <div className="h-8 w-48 rounded-full bg-stone-200/70" />
            <div className="h-4 w-full max-w-md rounded-full bg-stone-200/60" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-black/5 bg-stone-50/80 p-5"
                >
                  <div className="h-5 w-32 rounded-full bg-stone-200/70" />
                  <div className="mt-3 h-4 w-full rounded-full bg-stone-200/60" />
                  <div className="mt-2 h-4 w-24 rounded-full bg-stone-200/50" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : error ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <Box className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Unable to load your box
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">{error}</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </Card>
      ) : !hasBox ? (
        <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="space-y-4">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                No recovery box assigned
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Your recovery kit details are not available yet. If you were expecting a box, your clinic can help confirm the assignment.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                  Prescribed kit
                </p>
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    {boxType}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Clinic-provided supplies and related recovery instructions for your current kit.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                <BadgeCheck className="h-4 w-4" />
                {sourceBadgeText(data?.source)}
              </div>
            </div>
          </Card>

          <section className="space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Included supplies
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Open any item to review the instructions included with your recovery box.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const routeKey = itemRouteKey(item);

                return (
                  <Card
                    key={item.key || routeKey}
                    className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/my-box/${encodeURIComponent(routeKey)}`, {
                          state: {
                            itemKey: routeKey,
                            itemLabel: item.label,
                            item,
                          },
                        })
                      }
                      className={cn(
                        "w-full text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                            <Box className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold tracking-tight text-foreground">
                              {item.label}
                            </h3>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {item.description || item.education
                                ? "View instructions and supporting details."
                                : "Open this item for guidance and clinic-provided details."}
                            </p>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                          <span>View instructions</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
