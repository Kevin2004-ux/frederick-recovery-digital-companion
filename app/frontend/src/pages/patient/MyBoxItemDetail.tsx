import { ArrowLeft, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";

interface MyBoxResponse {
  myBox: {
    includedItems: Array<{ key: string; label: string }>;
    items: BoxItem[];
  } | null;
}

interface BoxItem {
  key: string | null;
  label: string;
  education?: {
    title?: string;
    summary?: string;
    instructions?: string[];
    warnings?: string[];
  } | null;
}

export function MyBoxItemDetail() {
  const { itemKey = "" } = useParams();
  const [items, setItems] = useState<BoxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void api
      .get<MyBoxResponse>("/activation/my-box")
      .then((response) => {
        if (!active) {
          return;
        }

        setItems(response.myBox?.items || []);
        setError("");
      })
      .catch((caughtError) => {
        if (!active) {
          return;
        }

        setItems([]);
        setError((caughtError as ApiError).message || "Unable to load this box item.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const item = useMemo(
    () => items.find((candidate) => candidate.key === itemKey) || null,
    [itemKey, items],
  );

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-4xl">
        <Link className="button-ghost" to={routes.patientMyBox}>
          <ArrowLeft className="h-4 w-4" />
          Back to My Box
        </Link>

        <Card className="mt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow">Box item detail</p>
              <h1 className="section-title mt-2">{item?.label || "Box item"}</h1>
              <p className="section-subtitle">
                This detail page is driven from the locked `/activation/my-box` contract.
              </p>
            </div>
          </div>

          {loading ? (
            <StatePanel
              className="mt-6"
              description="Loading activation-linked item guidance."
              title="Loading box item"
            />
          ) : error ? (
            <StatePanel className="mt-6" description={error} title="Box item issue" tone="danger" />
          ) : item ? (
            <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  {item.education?.title || "Current guidance"}
                </p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {item.education?.summary ||
                    "No additional item education was returned for this box item."}
                </p>
                {item.education?.instructions?.length ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                    {item.education.instructions.map((instruction) => (
                      <li key={instruction}>{instruction}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  {item.education?.warnings?.length ? "Warnings" : "Suggested next step"}
                </p>
                {item.education?.warnings?.length ? (
                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                    {item.education.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    Use Medical Hub for related recovery education or medication context while keeping this
                    item tied to your activation-linked kit.
                  </p>
                )}
                <Link className="button-secondary mt-4" to={routes.patientMedicalHub}>
                  Open Medical Hub
                </Link>
              </div>
            </div>
          ) : (
            <StatePanel
              className="mt-6"
              description="The selected item key was not found in the current activation-linked box."
              title="Box item unavailable"
              tone="warning"
            />
          )}
        </Card>
      </div>

      <PatientBottomNav />
    </main>
  );
}
