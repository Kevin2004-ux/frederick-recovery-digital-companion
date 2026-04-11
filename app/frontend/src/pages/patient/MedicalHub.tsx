import { Pill, Search, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";

import { PatientBottomNav } from "@/components/patient/PatientBottomNav";
import { RecoveryCard } from "@/components/hub/RecoveryCard";
import { MedCard } from "@/components/hub/MedCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import {
  INTERNAL_RECOVERY_GUIDES,
  type MedicationResult,
  type RecoveryGuide,
} from "@/types/hub";

function truncateArray(value: unknown, maxLength = 2) {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.slice(0, maxLength).join(" ");
}

async function searchOpenFda(query: string) {
  const encoded = encodeURIComponent(
    `openfda.brand_name:"${query}" OR openfda.generic_name:"${query}"`,
  );
  const response = await fetch(`https://api.fda.gov/drug/label.json?search=${encoded}&limit=6`);
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error("openFDA lookup failed");
  }

  const payload = (await response.json()) as {
    results?: Array<
      Record<string, unknown> & {
        openfda?: { brand_name?: string[]; generic_name?: string[] };
      }
    >;
  };

  return (payload.results || []).map<MedicationResult>((result) => ({
    name:
      truncateArray(result.openfda?.brand_name) ||
      truncateArray(result.openfda?.generic_name) ||
      "Medication",
    brand: truncateArray(result.openfda?.brand_name),
    generic: truncateArray(result.openfda?.generic_name),
    purpose: truncateArray(result.purpose, 1),
    boxedWarning: truncateArray(result.boxed_warning, 1),
    sourceLabel: "openFDA label",
  }));
}

async function searchMedline(query: string) {
  const response = await fetch(
    `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=6&term=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error("MedlinePlus lookup failed");
  }

  const xml = await response.text();
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(xml, "text/xml");
  const documents = Array.from(documentNode.querySelectorAll("document"));

  return documents.map<RecoveryGuide>((node, index) => {
    const title =
      node.querySelector("content[name='title']")?.textContent?.trim() ||
      `Medline topic ${index + 1}`;
    const summary =
      node.querySelector("content[name='FullSummary']")?.textContent?.trim() ||
      "Official MedlinePlus topic.";
    const link = node.querySelector("content[name='url']")?.textContent?.trim() || "";
    return {
      id: `medline-${index}-${title}`,
      title,
      summary,
      sourceLabel: "MedlinePlus",
      category: "medline",
      link,
    };
  });
}

export function MedicalHub() {
  const [medicationQuery, setMedicationQuery] = useState("");
  const [recoveryQuery, setRecoveryQuery] = useState("");
  const [medications, setMedications] = useState<MedicationResult[]>([]);
  const [recoveryResults, setRecoveryResults] = useState<RecoveryGuide[]>([]);
  const [medicationError, setMedicationError] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [medicationLoading, setMedicationLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [medicationSearched, setMedicationSearched] = useState(false);
  const [recoverySearched, setRecoverySearched] = useState(false);

  const internalGuides = useMemo(() => {
    if (!recoveryQuery.trim()) {
      return INTERNAL_RECOVERY_GUIDES;
    }

    const query = recoveryQuery.toLowerCase();
    return INTERNAL_RECOVERY_GUIDES.filter((guide) => {
      return guide.title.toLowerCase().includes(query) || guide.summary.toLowerCase().includes(query);
    });
  }, [recoveryQuery]);

  async function handleMedicationSearch() {
    setMedicationLoading(true);
    setMedicationError("");
    setMedicationSearched(true);
    try {
      setMedications(await searchOpenFda(medicationQuery.trim()));
    } catch (error) {
      setMedicationError((error as Error).message || "Unable to search openFDA.");
    } finally {
      setMedicationLoading(false);
    }
  }

  async function handleRecoverySearch() {
    setRecoveryLoading(true);
    setRecoveryError("");
    setRecoverySearched(true);
    try {
      setRecoveryResults(await searchMedline(recoveryQuery.trim()));
    } catch (error) {
      setRecoveryError((error as Error).message || "Unable to search MedlinePlus.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <main className="bg-app pb-28">
      <div className="app-shell max-w-6xl">
        <PageIntro
          description="Public lookups happen directly from the frontend while your patient workflow still uses the existing backend."
          eyebrow="Medical Hub"
          title="Medication and recovery education"
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-700">
                <Pill className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Medication lookup</h2>
                <p className="section-subtitle">
                  Search openFDA label information for medicine names.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                className="field flex-1"
                onChange={(event) => setMedicationQuery(event.target.value)}
                placeholder="Search medication"
                value={medicationQuery}
              />
              <Button
                className="justify-center"
                disabled={!medicationQuery.trim() || medicationLoading}
                onClick={handleMedicationSearch}
              >
                <Search className="h-4 w-4" />
                {medicationLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {medicationError ? (
              <StatePanel className="mt-4" description={medicationError} title="Medication lookup issue" tone="danger" />
            ) : null}

            <div className="mt-6 grid gap-4">
              {medications.length ? (
                medications.map((result) => (
                  <MedCard key={`${result.name}-${result.generic || ""}`} result={result} />
                ))
              ) : medicationSearched && !medicationLoading && !medicationError ? (
                <StatePanel
                  description="No medication labels matched that search. Try a brand name or generic name."
                  title="No medication results"
                  tone="warning"
                />
              ) : (
                <StatePanel
                  description="Search for a medication to see label-backed public information."
                  title="No medication results yet"
                />
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <h2 className="section-title">Recovery topics</h2>
                <p className="section-subtitle">
                  Blend Frederick Recovery guides with MedlinePlus search results.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                className="field flex-1"
                onChange={(event) => setRecoveryQuery(event.target.value)}
                placeholder="Search recovery topic"
                value={recoveryQuery}
              />
              <Button
                className="justify-center"
                disabled={!recoveryQuery.trim() || recoveryLoading}
                onClick={handleRecoverySearch}
              >
                <Search className="h-4 w-4" />
                {recoveryLoading ? "Searching..." : "Search"}
              </Button>
            </div>

            {recoveryError ? (
              <StatePanel className="mt-4" description={recoveryError} title="Recovery topic lookup issue" tone="danger" />
            ) : null}

            <div className="mt-6 grid gap-4">
              {internalGuides.map((result) => (
                <RecoveryCard key={result.id} result={result} />
              ))}
              {recoveryResults.map((result) => (
                <RecoveryCard key={result.id} result={result} />
              ))}
              {recoverySearched &&
              !recoveryLoading &&
              !recoveryError &&
              internalGuides.length === 0 &&
              recoveryResults.length === 0 ? (
                <StatePanel
                  description="No internal guides or MedlinePlus topics matched that search."
                  title="No recovery topics found"
                  tone="warning"
                />
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      <PatientBottomNav />
    </main>
  );
}
