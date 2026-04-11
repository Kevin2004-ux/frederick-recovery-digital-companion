import { ChevronRight, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/Card";
import { routes } from "@/lib/routes";
import type { MedicationResult } from "@/types/hub";

interface MedCardProps {
  result: MedicationResult;
}

export function MedCard({ result }: MedCardProps) {
  const encoded = encodeURIComponent(btoa(JSON.stringify(result)));

  return (
    <Link to={`${routes.patientMedicalHubMed}?data=${encoded}`}>
      <Card className="h-full border-slate-100 transition hover:-translate-y-0.5 hover:border-brand-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              {result.sourceLabel}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">{result.name}</h3>
            {result.brand || result.generic ? (
              <p className="mt-1 text-sm text-slate-500">
                {result.brand ? `Brand: ${result.brand}` : null}
                {result.brand && result.generic ? " • " : null}
                {result.generic ? `Generic: ${result.generic}` : null}
              </p>
            ) : null}
          </div>
          <ChevronRight className="mt-1 h-5 w-5 text-slate-400" />
        </div>

        {result.purpose ? <p className="mt-4 text-sm leading-7 text-slate-600">{result.purpose}</p> : null}

        {result.boxedWarning ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-700" />
              <p className="text-sm leading-6 text-amber-800">{result.boxedWarning}</p>
            </div>
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
