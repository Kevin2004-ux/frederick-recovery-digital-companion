import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { routes } from "@/lib/routes";
import type { RecoveryGuide } from "@/types/hub";

interface RecoveryCardProps {
  result: RecoveryGuide;
}

export function RecoveryCard({ result }: RecoveryCardProps) {
  const query = new URLSearchParams({
    id: result.id,
    category: result.category,
    title: result.title,
    summary: result.summary,
    sourceLabel: result.sourceLabel,
    link: result.link || "",
  });

  return (
    <Link to={`${routes.patientMedicalHubRecovery}?${query.toString()}`}>
      <Card className="h-full border-slate-100 transition hover:-translate-y-0.5 hover:border-brand-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge tone={result.category === "internal" ? "success" : "info"}>
              {result.sourceLabel}
            </Badge>
            <h3 className="mt-3 text-lg font-semibold text-slate-950">{result.title}</h3>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 text-slate-400" />
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-600">{result.summary}</p>
      </Card>
    </Link>
  );
}
