import { ChevronRight, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildPatientMyBoxItemRoute } from "@/lib/routes";

interface MyBoxResponse {
  myBox: {
    batchId: string;
    boxType: string | null;
    includedItems: Array<{ key: string; label: string }>;
    items: Array<{ key: string; label: string; education?: unknown }>;
  } | null;
}

export function MyBox() {
  const [data, setData] = useState<MyBoxResponse["myBox"]>(null);
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

        setData(response.myBox);
        setError("");
      })
      .catch((caughtError) => {
        if (!active) {
          return;
        }

        setData(null);
        setError((caughtError as ApiError).message || "Unable to load box contents.");
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

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-5xl">
        <PageIntro
          description="These items come from the authenticated patient’s claimed activation batch via `/activation/my-box`."
          eyebrow="My Box"
          title="Recovery kit contents"
        />

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h2 className="section-title">{data?.boxType || "No linked box yet"}</h2>
              <p className="section-subtitle">
                {data
                  ? `${data.includedItems.length} linked item(s)`
                  : "A claimed activation batch has not been linked yet."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {loading ? (
              <StatePanel
                description="Loading the activation-linked recovery kit for this patient."
                title="Loading box contents"
              />
            ) : error ? (
              <StatePanel description={error} title="Box data issue" tone="danger" />
            ) : data?.includedItems.length ? (
              data.includedItems.map((item) => (
                <Link
                  className="flex items-center justify-between rounded-[26px] border border-slate-100 bg-slate-50 px-4 py-4 transition hover:bg-slate-100"
                  key={item.key}
                  to={buildPatientMyBoxItemRoute(item.key)}
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-500">Open guidance for this kit item.</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </Link>
              ))
            ) : (
              <StatePanel
                description="Your clinic has not attached item metadata to this activation batch yet."
                title="No box items linked"
              />
            )}
          </div>

          {data?.batchId ? <Badge className="mt-5" tone="info">Batch {data.batchId}</Badge> : null}
        </Card>
      </div>

      <PatientBottomNav />
    </main>
  );
}
