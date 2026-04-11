import { ArrowLeft, ExternalLink, Pill } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";
import type { MedicationResult } from "@/types/hub";

export function MedicalHubMedDetail() {
  const [params] = useSearchParams();
  const medication = useMemo<MedicationResult | null>(() => {
    const encoded = params.get("data");
    if (!encoded) {
      return null;
    }
    try {
      return JSON.parse(atob(decodeURIComponent(encoded))) as MedicationResult;
    } catch {
      return null;
    }
  }, [params]);

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-4xl">
        <Link className="button-ghost" to={routes.patientMedicalHub}>
          <ArrowLeft className="h-4 w-4" />
          Back to Medical Hub
        </Link>

        <Card className="mt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow">Medication detail</p>
              <h1 className="section-title mt-2">{medication?.name || "Medication detail"}</h1>
              <p className="section-subtitle">
                Public reference only. Always follow your clinic directions first.
              </p>
            </div>
          </div>

          {medication ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Brand</p>
                <p className="mt-1 font-medium text-slate-900">{medication.brand || "Not listed"}</p>
              </div>
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Generic</p>
                <p className="mt-1 font-medium text-slate-900">{medication.generic || "Not listed"}</p>
              </div>
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Purpose</p>
                <p className="mt-1 text-sm leading-7 text-slate-700">
                  {medication.purpose || "No additional purpose text was returned."}
                </p>
              </div>
              <div className="rounded-[26px] border border-amber-200 bg-amber-50 p-4 md:col-span-2">
                <p className="text-sm font-semibold text-amber-800">Warning summary</p>
                <p className="mt-1 text-sm leading-7 text-amber-800">
                  {medication.boxedWarning || "No boxed warning surfaced in the lookup response."}
                </p>
              </div>
            </div>
          ) : (
            <StatePanel
              className="mt-6"
              description="The medication detail could not be reconstructed from the current route data."
              title="Medication detail unavailable"
              tone="warning"
            />
          )}

          <a
            className="button-secondary mt-6"
            href="https://open.fda.gov/apis/drug/label/"
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4" />
            openFDA documentation
          </a>
        </Card>
      </div>

      <PatientBottomNav />
    </main>
  );
}
