import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Droplets,
  HeartPulse,
  Pill,
  Search,
  ShieldAlert,
  ShowerHead,
  Syringe,
  Thermometer,
  UserRoundCheck,
} from "lucide-react";

import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type HubSection = "care-guides" | "medication-safety";

type HubTopic = {
  id: string;
  section: HubSection;
  title: string;
  summary: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOPICS: HubTopic[] = [
  {
    id: "wound-care",
    section: "care-guides",
    title: "Wound & Incision Care",
    summary: "Keep the area clean and follow the dressing plan from your clinic.",
    detail:
      "Use your clinic’s wound care instructions as your main source of guidance. If the area looks different than expected, feels warmer, or becomes more painful, contact your clinic for advice.",
    icon: Thermometer,
  },
  {
    id: "showering-incision",
    section: "care-guides",
    title: "How to Shower With an Incision",
    summary: "Return to showering only when your clinic says it is safe to do so.",
    detail:
      "Your care team should guide when showering is appropriate and whether the incision should stay covered. Avoid soaking in tubs, pools, or hot tubs until your clinic says that part of healing is ready.",
    icon: ShowerHead,
  },
  {
    id: "changing-dressings",
    section: "care-guides",
    title: "Changing Dressings Safely",
    summary: "Use clean hands, clean supplies, and the dressing steps your clinic gave you.",
    detail:
      "If you were given dressing instructions, follow those steps closely and change supplies as directed. Contact your clinic if the dressing becomes hard to manage, won’t stay in place, or the wound looks different than expected.",
    icon: UserRoundCheck,
  },
  {
    id: "swelling",
    section: "care-guides",
    title: "Managing Swelling",
    summary: "Rest, elevation, and your clinic’s plan can help reduce swelling.",
    detail:
      "Swelling can change during recovery, especially after activity. Keep using the techniques recommended by your care team and note changes in your daily check-in when helpful.",
    icon: Droplets,
  },
  {
    id: "hygiene",
    section: "care-guides",
    title: "Hygiene & Showering",
    summary: "Return to normal hygiene gradually and only as your clinic recommends.",
    detail:
      "Ask your clinic when showering, soaking, or changing products is appropriate for your recovery. If you have a dressing, use the specific instructions your clinic gave you.",
    icon: ShowerHead,
  },
  {
    id: "sleep-rest",
    section: "care-guides",
    title: "Sleep and Rest During Recovery",
    summary: "Give your body time to rest while keeping a steady daily routine when you can.",
    detail:
      "Recovery can make sleep feel different for a while. Try to build in regular rest, keep common supplies close by, and use positioning or support pillows only in ways your clinic has recommended.",
    icon: HeartPulse,
  },
  {
    id: "gentle-movement",
    section: "care-guides",
    title: "Returning to Gentle Movement Safely",
    summary: "Ease back into light movement within the limits from your care team.",
    detail:
      "Short walks and gentle movement may be part of recovery, but the right pace depends on your procedure. Follow your clinic’s activity limits and slow down if symptoms worsen or something feels unsafe.",
    icon: UserRoundCheck,
  },
  {
    id: "recovery-basics",
    section: "care-guides",
    title: "Rest, Mobility & Recovery Basics",
    summary: "Balance movement, rest, hydration, and daily routines as you recover.",
    detail:
      "Short walks, rest, hydration, and following activity guidance can all support recovery. Increase activity only within the limits your clinic has given you.",
    icon: UserRoundCheck,
  },
  {
    id: "pain-medication",
    section: "medication-safety",
    title: "Pain Medication Basics",
    summary: "Take medication only as prescribed and track how it affects your day.",
    detail:
      "Use the instructions from your clinic or prescription label. If pain control is not working as expected or you are unsure about dosing, contact your clinic before making changes.",
    icon: Pill,
  },
  {
    id: "otc-pain-meds",
    section: "medication-safety",
    title: "Safe Use of Over-the-Counter Pain Medication",
    summary: "Only add over-the-counter medication if it is allowed in your recovery plan.",
    detail:
      "Some patients are told they can use over-the-counter pain relievers, while others should avoid certain options. Check with your clinic or pharmacist before combining medicines, especially if you have questions about timing or dosage.",
    icon: Pill,
  },
  {
    id: "constipation",
    section: "medication-safety",
    title: "Managing Constipation From Pain Medication",
    summary: "Prescription pain medicine can sometimes slow digestion during recovery.",
    detail:
      "If constipation becomes a concern, contact your clinic or pharmacist for guidance on safe next steps. Hydration, gentle movement, and following the bowel-care guidance from your care team can also help when appropriate.",
    icon: Droplets,
  },
  {
    id: "side-effects",
    section: "medication-safety",
    title: "Common Side Effects",
    summary: "Some medications can cause nausea, dizziness, or stomach upset.",
    detail:
      "If side effects are new, strong, or getting worse, let your clinic know. Keep notes on what you notice so you can describe the pattern clearly.",
    icon: HeartPulse,
  },
  {
    id: "prescription-safety",
    section: "medication-safety",
    title: "Prescription Safety",
    summary: "Store medications safely and use them only as directed.",
    detail:
      "Keep medications out of reach of children and avoid sharing prescriptions. If you miss a dose or have a question about timing, contact your clinic or pharmacist.",
    icon: Syringe,
  },
  {
    id: "contact-clinic",
    section: "medication-safety",
    title: "When to Contact Your Clinic",
    summary: "Reach out for worsening pain, new symptoms, or anything that feels concerning.",
    detail:
      "Your clinic should guide decisions about urgent symptoms, medication concerns, or changes in recovery. If something feels serious or unsafe, seek urgent care right away.",
    icon: ShieldAlert,
  },
];

export default function MedicalHub() {
  const navigate = useNavigate();
  const [section, setSection] = useState<HubSection>("care-guides");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return TOPICS.filter((topic) => {
      if (topic.section !== section) return false;
      if (!normalized) return true;

      return (
        topic.title.toLowerCase().includes(normalized) ||
        topic.summary.toLowerCase().includes(normalized)
      );
    });
  }, [query, section]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-7">
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
            Medical Hub
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            General recovery education and safety guidance to support the instructions from your clinic.
          </p>
        </div>
      </header>

      <section className="space-y-4">
        <SegmentedControl
          value={section}
          onChange={(value) => {
            setSection(value);
            setExpandedId(null);
          }}
          options={[
            { label: "Care Guides", value: "care-guides" },
            { label: "Medication & Safety", value: "medication-safety" },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              section === "care-guides"
                ? "Search care guides"
                : "Search medication and safety topics"
            }
            className="pl-11"
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {filteredTopics.length === 0 ? (
          <Card className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  No topics found
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Try a different search term or switch to the other content group.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          filteredTopics.map((topic) => {
            const Icon = topic.icon;
            const isExpanded = expandedId === topic.id;

            return (
              <Card
                key={topic.id}
                className="rounded-[30px] border border-black/5 bg-white/95 p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((current) =>
                      current === topic.id ? null : topic.id
                    )
                  }
                  className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="space-y-1.5">
                        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                          {topic.title}
                        </h2>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                      <span>{isExpanded ? "Less" : "Read more"}</span>
                      <ArrowRight
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="mt-4 rounded-2xl bg-stone-50/80 p-4 text-sm leading-6 text-muted-foreground">
                    {topic.detail}
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
              Educational information only
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Use this page as general educational guidance only. Follow the instructions from your clinic for your own recovery, and contact your clinic or urgent care services directly if you have serious concerns.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
