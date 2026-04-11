export interface MedicationResult {
  name: string;
  brand: string | null;
  generic: string | null;
  purpose: string | null;
  boxedWarning: string | null;
  sourceLabel: string;
  link?: string;
}

export interface RecoveryGuide {
  id: string;
  title: string;
  summary: string;
  sourceLabel: string;
  category: "internal" | "medline";
  link?: string;
  sections?: Array<{
    title: string;
    items: string[];
  }>;
}

export const INTERNAL_RECOVERY_GUIDES: RecoveryGuide[] = [
  {
    id: "dressing-care",
    title: "Dressing Care Basics",
    summary: "A simple checklist for changing or checking dressings at home.",
    sourceLabel: "Frederick Recovery Education",
    category: "internal",
    sections: [
      {
        title: "Before you start",
        items: [
          "Wash your hands and gather clean supplies first.",
          "Do not place dressing materials directly on unclean surfaces.",
          "If your clinic gave custom wound instructions, follow those over general guidance.",
        ],
      },
      {
        title: "Call your clinic if you notice",
        items: [
          "Spreading redness, drainage, unusual odor, or worsening swelling.",
          "Bleeding that does not slow after gentle pressure.",
          "A dressing that becomes soaked repeatedly.",
        ],
      },
    ],
  },
  {
    id: "swelling-control",
    title: "Swelling Control",
    summary: "When elevation, rest, and icing can help calm routine post-procedure swelling.",
    sourceLabel: "Frederick Recovery Education",
    category: "internal",
    sections: [
      {
        title: "Practical steps",
        items: [
          "Elevate the affected area above heart level when possible.",
          "Use cold therapy only if your clinic has not told you to avoid it.",
          "Keep a short note in your tracker when swelling increases instead of improving.",
        ],
      },
      {
        title: "Escalation signs",
        items: [
          "Swelling that rapidly increases or arrives with redness, fever, or chest symptoms needs medical review.",
          "If one limb becomes dramatically more swollen than the other, contact your clinic promptly.",
        ],
      },
    ],
  },
  {
    id: "medication-reminders",
    title: "Medication Reminder Basics",
    summary: "A gentle plan for staying on schedule and noting missed doses safely.",
    sourceLabel: "Frederick Recovery Education",
    category: "internal",
    sections: [
      {
        title: "Staying consistent",
        items: [
          "Use the tracker notes field if you miss a dose or have side effects.",
          "Do not double up unless your clinician explicitly told you to.",
          "Bring medication questions to your clinic before adjusting your routine.",
        ],
      },
    ],
  },
  {
    id: "when-to-call",
    title: "When to Call the Clinic",
    summary: "Common recovery changes that deserve a direct check-in with your care team.",
    sourceLabel: "Frederick Recovery Education",
    category: "internal",
    sections: [
      {
        title: "Reach out for",
        items: [
          "Pain or swelling that keeps rising instead of settling down.",
          "Fever, drainage changes, or redness that spreads beyond the incision area.",
          "Questions about medications, dressings, or what is safe to do next.",
        ],
      },
    ],
  },
];
