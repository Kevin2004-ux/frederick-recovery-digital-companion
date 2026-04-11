import { Lock, Save, SearchCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, ApiError } from "@/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageIntro } from "@/components/ui/PageIntro";
import { StatePanel } from "@/components/ui/StatePanel";
import { routes } from "@/lib/routes";
import { defaultPlanConfig, type PlanConfig } from "@/types/clinic";

interface PreviewResponse {
  status: string;
  plan: {
    days?: Array<{
      dayIndex: number;
      phase?: string;
      moduleIds?: string[];
    }>;
  };
}

const planFields: Array<{ key: keyof PlanConfig; label: string; options: string[] }> = [
  {
    key: "recovery_region",
    label: "Recovery region",
    options: ["leg_foot", "arm_hand", "torso", "face_neck", "general"],
  },
  {
    key: "recovery_duration",
    label: "Recovery duration",
    options: ["standard_0_7", "standard_8_14", "standard_15_21", "extended_22_plus"],
  },
  {
    key: "mobility_impact",
    label: "Mobility impact",
    options: ["none", "mild", "limited", "non_weight_bearing"],
  },
  {
    key: "incision_status",
    label: "Incision status",
    options: ["intact_dressings", "sutures_staples", "drains_present", "open_wound", "none_visible"],
  },
  {
    key: "discomfort_pattern",
    label: "Discomfort pattern",
    options: ["expected_soreness", "sharp_intermittent", "burning_tingling", "escalating"],
  },
  {
    key: "follow_up_expectation",
    label: "Follow-up expectation",
    options: ["within_7_days", "within_14_days", "within_30_days", "none_scheduled"],
  },
];

export function ClinicCodeManager() {
  const [params] = useSearchParams();
  const code = useMemo(() => params.get("code") || "", [params]);
  const [config, setConfig] = useState<PlanConfig>(defaultPlanConfig);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveConfig() {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ activation: { status: string } }>(
        `/clinic/activation/${encodeURIComponent(code)}/config`,
        { config },
      );
      setStatus(response.activation.status);
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to save the activation config.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<PreviewResponse>(
        `/clinic/activation/${encodeURIComponent(code)}/preview`,
      );
      setPreview(response);
      setStatus(response.status);
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to preview the plan.");
    } finally {
      setLoading(false);
    }
  }

  async function approve() {
    setLoading(true);
    setError("");
    try {
      const response = await api.post<{ activation: { status: string } }>(
        `/clinic/activation/${encodeURIComponent(code)}/approve`,
      );
      setStatus(response.activation.status);
    } catch (caughtError) {
      const apiError = caughtError as ApiError;
      setError(apiError.message || "Unable to approve this code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-app">
      <div className="app-shell max-w-6xl">
        <Link className="button-ghost" to={routes.clinicDashboard}>
          Back to dashboard
        </Link>

        <PageIntro
          className="mt-5"
          description="This screen preserves `/clinic/activation/:code/config`, `/preview`, and `/approve` exactly."
          eyebrow="Clinic code manager"
          title="Configure activation code"
          actions={
            status ? (
              <Badge tone={status === "APPROVED" ? "success" : status === "DRAFT" ? "warning" : "info"}>
                {status}
              </Badge>
            ) : null
          }
        />

        {error ? <StatePanel className="mb-5" description={error} title="Code management issue" tone="danger" /> : null}

        <Card>
          <p className="eyebrow">Activation code</p>
          <p className="mt-3 font-mono text-lg text-slate-900">
            {code || "Missing ?code= parameter"}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {planFields.map((field) => (
              <div key={field.key}>
                <label className="field-label" htmlFor={field.key}>
                  {field.label}
                </label>
                <select
                  className="field"
                  id={field.key}
                  onChange={(event) => {
                    setConfig((current) => ({
                      ...current,
                      [field.key]: event.target.value as PlanConfig[typeof field.key],
                    }));
                  }}
                  value={config[field.key]}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button disabled={!code || loading} onClick={saveConfig}>
              <Save className="h-4 w-4" />
              Save config
            </Button>
            <Button disabled={!code || loading} onClick={loadPreview} variant="secondary">
              <SearchCheck className="h-4 w-4" />
              Preview plan
            </Button>
            <Button disabled={!code || loading || status !== "DRAFT"} onClick={approve} variant="secondary">
              <Lock className="h-4 w-4" />
              Approve code
            </Button>
          </div>
        </Card>

        {preview ? (
          <Card className="mt-5">
            <p className="eyebrow">Plan preview</p>
            <p className="section-subtitle mt-3">
              Rendered from `/clinic/activation/:code/preview` without modifying clinic plan generation.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {preview.plan.days?.slice(0, 9).map((day) => (
                <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-4" key={day.dayIndex}>
                  <p className="font-medium text-slate-900">Day {day.dayIndex + 1}</p>
                  <p className="mt-1 text-sm text-slate-500">Phase {day.phase || "general"}</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Modules: {day.moduleIds?.length ? day.moduleIds.join(", ") : "No module IDs returned."}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <StatePanel
            className="mt-5"
            description="Save a config and preview the generated plan to review the first nine days here."
            title="No preview loaded yet"
          />
        )}
      </div>
    </main>
  );
}
