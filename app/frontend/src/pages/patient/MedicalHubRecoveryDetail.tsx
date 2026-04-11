import { ArrowLeft, ExternalLink, Stethoscope } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { Card } from "@/components/ui/Card";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";
import { INTERNAL_RECOVERY_GUIDES } from "@/types/hub";

export function MedicalHubRecoveryDetail() {
  const [params] = useSearchParams();
  const category = params.get("category");
  const id = params.get("id") || "";
  const title = params.get("title") || "Recovery detail";
  const summary = params.get("summary") || "";
  const sourceLabel = params.get("sourceLabel") || "Reference";
  const link = params.get("link") || "";

  const internalGuide = useMemo(
    () =>
      category === "internal"
        ? INTERNAL_RECOVERY_GUIDES.find((guide) => guide.id === id) || null
        : null,
    [category, id],
  );

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-4xl">
        <Link className="button-ghost" to={routes.patientMedicalHub}>
          <ArrowLeft className="h-4 w-4" />
          Back to Medical Hub
        </Link>

        <Card className="mt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <p className="eyebrow">{sourceLabel}</p>
              <h1 className="section-title mt-2">{internalGuide?.title || title}</h1>
              <p className="section-subtitle">{internalGuide?.summary || summary}</p>
            </div>
          </div>

          {internalGuide?.sections?.length ? (
            <div className="mt-6 grid gap-4">
              {internalGuide.sections.map((section) => (
                <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4" key={section.title}>
                  <h2 className="font-semibold text-slate-900">{section.title}</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <StatePanel
              className="mt-6"
              description="This topic came from MedlinePlus search results. Open the official source for the full article."
              title="Official recovery topic"
            />
          )}

          {link ? (
            <a className="button-secondary mt-6" href={link} rel="noreferrer" target="_blank">
              <ExternalLink className="h-4 w-4" />
              Open official article
            </a>
          ) : null}
        </Card>
      </div>

      <PatientBottomNav />
    </main>
  );
}
