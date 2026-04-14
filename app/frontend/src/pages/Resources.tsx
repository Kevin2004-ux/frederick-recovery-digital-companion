import { useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bus,
  ClipboardList,
  Coins,
  HandCoins,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResourceSection = "coverage-billing" | "support-assistance";

type ResourceTopic = {
  id: string;
  section: ResourceSection;
  title: string;
  summary: string;
  bullets?: string[];
  detail: string;
  icon: ComponentType<{ className?: string }>;
};

const RESOURCES: ResourceTopic[] = [
  {
    id: "coverage",
    section: "coverage-billing",
    title: "Understanding Your Coverage",
    summary: "Review what your plan may cover and where questions are still worth asking.",
    bullets: [
      "Check the type of visit or service",
      "Confirm whether referrals are needed",
      "Ask about covered supplies or follow-up care",
    ],
    detail:
      "Coverage varies by plan, provider, and service type. If a benefit is unclear, contact your insurer directly and ask them to explain the next step in plain language.",
    icon: ShieldCheck,
  },
  {
    id: "eob",
    section: "coverage-billing",
    title: "Understanding Your Explanation of Benefits",
    summary: "An explanation of benefits is not the same thing as a bill, but it can help you compare what was processed.",
    bullets: [
      "Look for the date of service and provider name",
      "Check what the insurer says was covered or adjusted",
      "Compare it with any bill you receive later",
    ],
    detail:
      "If an explanation of benefits seems confusing, call your insurer’s member services line and ask them to explain the patient responsibility amount in plain language before you pay anything you do not understand.",
    icon: ShieldCheck,
  },
  {
    id: "billing-questions",
    section: "coverage-billing",
    title: "Billing Questions to Ask",
    summary: "Keep a short list of questions ready before calling your clinic or billing team.",
    bullets: [
      "What does this charge relate to?",
      "Is there a payment timeline to know about?",
      "Who should I contact for next steps?",
    ],
    detail:
      "It can help to write down dates, claim numbers, and who you spoke with. A short call summary makes follow-up much easier if you need to revisit the same issue later.",
    icon: ReceiptText,
  },
  {
    id: "out-of-pocket",
    section: "coverage-billing",
    title: "Out-of-Pocket Cost Planning",
    summary: "Plan ahead for expenses that may not be fully covered.",
    bullets: [
      "List expected recovery-related expenses",
      "Ask about payment options early",
      "Keep receipts and billing notes together",
    ],
    detail:
      "Even when coverage exists, co-pays, deductibles, or supply costs can vary. A simple written list can make it easier to stay organized during recovery.",
    icon: Coins,
  },
  {
    id: "insurance-checklist",
    section: "coverage-billing",
    title: "Insurance Contact Checklist",
    summary: "Gather the details you may want before speaking with your insurer.",
    bullets: [
      "Member ID and service dates",
      "Clinic or provider name",
      "Questions about approvals, claims, or costs",
    ],
    detail:
      "Calls tend to go more smoothly when you have the claim, date of service, and provider details nearby. Ask for a reference number if the insurer offers one.",
    icon: ClipboardList,
  },
  {
    id: "billing-office",
    section: "coverage-billing",
    title: "When to Call the Billing Office",
    summary: "Your hospital or clinic billing office can often explain charges, timing, and who owns the next step.",
    bullets: [
      "Ask which office handles the charge",
      "Confirm whether insurance was already billed",
      "Request the best number for follow-up if needed",
    ],
    detail:
      "If a statement seems unfamiliar, start with the hospital or clinic billing office listed on the paperwork. They can often clarify whether the charge is still being processed or if it needs insurer follow-up.",
    icon: ReceiptText,
  },
  {
    id: "transportation",
    section: "support-assistance",
    title: "Transportation Support",
    summary: "Plan rides for appointments, pharmacy pickups, or early recovery needs.",
    bullets: [
      "Ask family or friends for scheduled help",
      "Check local community transportation options",
      "Confirm transportation needs before appointments",
    ],
    detail:
      "Transportation needs can change during recovery. It helps to plan a few backup options in case mobility, timing, or appointment changes make travel harder than expected. If your plan includes transportation benefits, your insurer’s transportation benefit hotline or member services line may be able to explain what is available.",
    icon: Bus,
  },
  {
    id: "financial-assistance",
    section: "support-assistance",
    title: "Financial Assistance Programs",
    summary: "Some clinics, providers, or community groups may offer support programs.",
    bullets: [
      "Ask whether your clinic has financial guidance",
      "Check community or nonprofit support options",
      "Verify eligibility and required documents",
    ],
    detail:
      "Program availability varies and may depend on your location, provider, or insurance. Contact the organization directly for the most accurate information, and ask your clinic whether they work with any local financial counselors or assistance programs.",
    icon: HandCoins,
  },
  {
    id: "patient-advocates",
    section: "support-assistance",
    title: "Patient Advocate Resources",
    summary: "Patient advocacy groups may help you organize questions about bills, access, or next steps.",
    bullets: [
      "Write down the issue before you call",
      "Keep claim numbers and service dates nearby",
      "Ask what documentation would help your case",
    ],
    detail:
      "Groups such as the Patient Advocate Foundation may offer general guidance for navigating billing or access concerns. Local hospital social work teams or patient relations staff may also be helpful depending on your situation.",
    icon: Users,
  },
  {
    id: "caregiver-planning",
    section: "support-assistance",
    title: "Caregiver Planning",
    summary: "A simple recovery plan can make it easier for a helper to support you.",
    bullets: [
      "List who can help and when",
      "Share medication and appointment reminders",
      "Keep important phone numbers nearby",
    ],
    detail:
      "Even short-term help can make recovery smoother. A written plan can reduce stress for both you and the people supporting you at home.",
    icon: Users,
  },
  {
    id: "leave-planning",
    section: "support-assistance",
    title: "Employer and Leave Planning Basics",
    summary: "Work-related planning can feel easier when you gather paperwork early and keep updates organized.",
    bullets: [
      "Ask what documentation your employer needs",
      "Track deadlines for leave or return-to-work forms",
      "Keep copies of forms and contact names",
    ],
    detail:
      "Your clinic may be able to help with medical documentation, but employers and leave administrators often have their own timelines and forms. Ask your employer or leave administrator directly for the exact process that applies to you.",
    icon: ClipboardList,
  },
  {
    id: "home-preparation",
    section: "support-assistance",
    title: "Recovery-at-Home Preparation",
    summary: "Set up your space so common supplies and essentials are easy to reach.",
    bullets: [
      "Keep daily supplies in one place",
      "Plan meals, hydration, and rest areas",
      "Reduce unnecessary trips or lifting",
    ],
    detail:
      "A small amount of preparation can make the first days at home feel more manageable. Focus on comfort, safe movement, and having your basics within easy reach.",
    icon: WalletCards,
  },
];

export default function Resources() {
  const navigate = useNavigate();
  const [section, setSection] = useState<ResourceSection>("coverage-billing");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return RESOURCES.filter((resource) => {
      if (resource.section !== section) return false;
      if (!normalized) return true;

      return (
        resource.title.toLowerCase().includes(normalized) ||
        resource.summary.toLowerCase().includes(normalized)
      );
    });
  }, [query, section]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-7">
      <header className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          className="h-9 self-start rounded-full px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-900"
          onClick={() => navigate("/home")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="space-y-2.5">
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-800">
            Support planning
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Resources
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            General support resources patients may find helpful while planning for recovery and follow-up care.
          </p>
        </div>
      </header>

      <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              General support resources
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              These topics are here to help you organize questions and next steps. Coverage, benefits, and available support can vary by plan, provider, and location.
            </p>
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <SegmentedControl
          value={section}
          onChange={(value) => {
            setSection(value);
            setExpandedId(null);
          }}
          options={[
            { label: "Coverage & Billing", value: "coverage-billing" },
            { label: "Support & Assistance", value: "support-assistance" },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              section === "coverage-billing"
                ? "Search coverage and billing topics"
                : "Search support and assistance topics"
            }
            className="pl-11"
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {filteredResources.length === 0 ? (
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  No resources found
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Try a different search term or switch to the other resource group.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          filteredResources.map((resource) => {
            const Icon = resource.icon;
            const isExpanded = expandedId === resource.id;

            return (
              <Card
                key={resource.id}
                className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === resource.id ? null : resource.id
                    )
                  }
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="space-y-1.5">
                        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                          {resource.title}
                        </h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {resource.summary}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800">
                      <span>{isExpanded ? "Less" : "Read more"}</span>
                      <ArrowRight
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="mt-4 space-y-4 rounded-2xl border border-emerald-100/80 bg-emerald-50/40 p-4 text-sm leading-6 text-muted-foreground">
                    {resource.bullets?.length ? (
                      <ul className="space-y-2">
                        {resource.bullets.map((bullet) => (
                          <li key={bullet} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p>{resource.detail}</p>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-foreground">
              General information only
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              These resources are meant for general planning and support only. Availability and coverage vary, so contact your clinic, insurer, hospital billing office, or provider directly for details that apply to you.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
