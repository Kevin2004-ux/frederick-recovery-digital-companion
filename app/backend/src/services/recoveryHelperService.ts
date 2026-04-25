import {
  CONTENT_LIBRARY,
  type ModuleDefinition,
} from "./plan/contentLibrary.js";

export type RecoveryHelperSection = {
  title: string;
  body?: string;
  items?: string[];
};

export type RecoveryHelperResult = {
  id: string;
  title: string;
  moduleType: ModuleDefinition["type"];
  summary: string;
  keyPoints: string[];
  sections: RecoveryHelperSection[];
  redFlags: string[];
  frequency?: string;
  requiredBoxItems: string[];
};

export type RecoveryHelperSearchResponse = {
  query: string;
  blocked: boolean;
  message: string;
  results: RecoveryHelperResult[];
};

const MAX_RESULTS = 5;
const BLOCKED_PATTERNS = [
  /\bis this (normal|infected|serious|okay)\b/i,
  /\bdo i have\b/i,
  /\bam i (okay|safe)\b/i,
  /\bshould i worry\b/i,
  /\bwhat diagnosis\b/i,
  /\bdo i need antibiotics\b/i,
  /\bwhat medicine should i take\b/i,
  /\bwhat medication should i take\b/i,
  /\bmy [a-z]+ is [a-z]+ and [a-z]+\b/i,
  /\b(is|are) this a sign of\b/i,
  /\bdoes this mean\b/i,
];

const ALLOWED_MODULE_TYPES: ModuleDefinition["type"][] = [
  "education",
  "task",
  "milestone",
];

type QueryExpansionRule = {
  triggers: string[];
  phrases: string[];
  preferredModuleIds?: string[];
};

type InterpretedQuery = {
  normalizedQuery: string;
  directTokens: string[];
  expandedTerms: string[];
  preferredModuleIds: string[];
};

const QUERY_EXPANSION_RULES: QueryExpansionRule[] = [
  {
    triggers: ["shower", "showering", "bathe", "bathing"],
    phrases: ["showering", "wound care", "incision care", "keeping incision clean"],
    preferredModuleIds: [
      "education_wound_care_basic",
      "education_wound_care_sutures",
      "task_gauze_change",
    ],
  },
  {
    triggers: ["incision", "wound", "stitches", "sutures", "staples"],
    phrases: [
      "incision care",
      "wound care",
      "keeping incision clean",
      "sutures care",
      "dressing change",
    ],
    preferredModuleIds: [
      "education_wound_care_basic",
      "education_wound_care_sutures",
      "task_check_incision",
      "task_gauze_change",
    ],
  },
  {
    triggers: ["swollen", "swelling", "puffy"],
    phrases: [
      "swelling after surgery",
      "reduce swelling",
      "elevation",
      "cold therapy",
    ],
    preferredModuleIds: [
      "education_ice_knee",
      "education_elevation",
      "sprain_rice_task",
    ],
  },
  {
    triggers: ["ice", "icing", "ice pack", "icepack", "cold pack", "cold therapy"],
    phrases: ["ice pack", "cold therapy", "swelling after surgery", "reduce swelling"],
    preferredModuleIds: [
      "education_ice_knee",
      "education_elevation",
      "sprain_rice_task",
    ],
  },
  {
    triggers: ["walk", "walking", "movement", "move around", "mobility"],
    phrases: [
      "walking after surgery",
      "gentle movement",
      "mobility after surgery",
      "weight bearing",
    ],
    preferredModuleIds: [
      "education_mobility_walking",
      "education_mobility_gentle",
      "education_mobility_crutches",
    ],
  },
  {
    triggers: ["constipated", "constipation", "hard stool", "can t poop", "cant poop"],
    phrases: [
      "constipation",
      "bowel care",
      "hydration",
      "drinking fluids",
      "pain medicine side effects",
    ],
    preferredModuleIds: [
      "hernia_repair_task",
      "kidney_stones_education",
      "milestone_follow_up_prep",
    ],
  },
  {
    triggers: ["nausea", "nauseous", "sick to stomach", "throwing up", "vomiting"],
    phrases: ["nausea", "vomiting", "hydration", "follow up after surgery"],
    preferredModuleIds: [
      "milestone_follow_up_prep",
      "appendectomy_education",
      "gallbladder_removal_education",
    ],
  },
  {
    triggers: ["pain meds", "pain med", "pain medicine", "opioid", "opioids"],
    phrases: [
      "pain medicine",
      "postoperative pain",
      "constipation",
      "hydration",
      "follow up after surgery",
    ],
    preferredModuleIds: [
      "track_pain_daily",
      "track_pain_movement",
      "milestone_follow_up_prep",
      "hernia_repair_task",
    ],
  },
];

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function normalizedIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return haystack.includes(normalizeText(needle));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sentenceParts(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstSentence(text: string): string {
  return sentenceParts(text)[0] ?? text.trim();
}

function blockReasonForQuery(query: string): string | null {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return "For personal symptoms or diagnosis questions, contact your clinic directly. This helper can only share general recovery education.";
    }
  }

  return null;
}

function isEligibleModule(moduleDef: ModuleDefinition): boolean {
  return ALLOWED_MODULE_TYPES.includes(moduleDef.type);
}

function interpretQuery(query: string): InterpretedQuery {
  const normalizedQuery = normalizeQuery(query);
  const normalizedText = normalizeText(normalizedQuery);
  const directTokens = uniqueStrings(tokenize(normalizedQuery));
  const expandedTerms = new Set<string>([normalizedQuery, ...directTokens]);
  const preferredModuleIds = new Set<string>();

  for (const rule of QUERY_EXPANSION_RULES) {
    const triggered = rule.triggers.some((trigger) =>
      normalizedIncludes(normalizedText, trigger)
    );

    if (!triggered) continue;

    for (const phrase of rule.phrases) {
      expandedTerms.add(phrase);
      for (const token of tokenize(phrase)) {
        expandedTerms.add(token);
      }
    }

    for (const moduleId of rule.preferredModuleIds ?? []) {
      preferredModuleIds.add(moduleId);
    }
  }

  return {
    normalizedQuery,
    directTokens,
    expandedTerms: uniqueStrings(Array.from(expandedTerms)),
    preferredModuleIds: Array.from(preferredModuleIds),
  };
}

function matchScore(
  moduleDef: ModuleDefinition,
  interpretedQuery: InterpretedQuery
): number {
  const normalizedQuery = normalizeText(interpretedQuery.normalizedQuery);
  const title = normalizeText(moduleDef.title);
  const id = normalizeText(moduleDef.id.replace(/_/g, " "));
  const body = normalizeText(moduleDef.text);
  const tags = (moduleDef.medlineSearchTags ?? []).map(normalizeText);
  const redFlags = (moduleDef.redFlags ?? []).map(normalizeText);
  const boxItems = (moduleDef.requiredBoxItems ?? []).map(normalizeText);
  const expandedTerms = interpretedQuery.expandedTerms
    .map((term) => normalizeText(term))
    .filter(Boolean);

  let score = 0;

  if (title.includes(normalizedQuery)) score += 120;
  if (id.includes(normalizedQuery)) score += 110;
  if (tags.some((tag) => tag.includes(normalizedQuery))) score += 100;
  if (body.includes(normalizedQuery)) score += 45;

  for (const token of interpretedQuery.directTokens) {
    if (title.includes(token)) score += 20;
    if (id.includes(token)) score += 18;
    if (tags.some((tag) => tag.includes(token))) score += 16;
    if (body.includes(token)) score += 6;
    if (redFlags.some((flag) => flag.includes(token))) score += 4;
    if (boxItems.some((item) => item.includes(token))) score += 3;
  }

  for (const term of expandedTerms) {
    if (!term || term === normalizedQuery) continue;

    if (title.includes(term)) score += 18;
    if (id.includes(term)) score += 16;
    if (tags.some((tag) => tag.includes(term))) score += 14;
    if (body.includes(term)) score += 7;
    if (redFlags.some((flag) => flag.includes(term))) score += 4;
    if (boxItems.some((item) => item.includes(term))) score += 4;
  }

  if (interpretedQuery.preferredModuleIds.includes(moduleDef.id)) score += 28;

  return score;
}

function buildSections(moduleDef: ModuleDefinition): RecoveryHelperSection[] {
  const sections: RecoveryHelperSection[] = [
    {
      title: "Overview",
      body: moduleDef.text.trim(),
    },
  ];

  if (moduleDef.redFlags?.length) {
    sections.push({
      title: "When to contact your clinic",
      items: uniqueStrings(moduleDef.redFlags),
    });
  }

  if (moduleDef.frequency?.trim()) {
    sections.push({
      title: "Timing",
      body: moduleDef.frequency.trim(),
    });
  }

  if (moduleDef.requiredBoxItems?.length) {
    sections.push({
      title: "Helpful items",
      items: uniqueStrings(moduleDef.requiredBoxItems),
    });
  }

  return sections;
}

function buildKeyPoints(moduleDef: ModuleDefinition): string[] {
  const points = sentenceParts(moduleDef.text).slice(0, 3);
  return uniqueStrings(points);
}

function buildResult(moduleDef: ModuleDefinition): RecoveryHelperResult {
  return {
    id: moduleDef.id,
    title: moduleDef.title,
    moduleType: moduleDef.type,
    summary: firstSentence(moduleDef.text),
    keyPoints: buildKeyPoints(moduleDef),
    sections: buildSections(moduleDef),
    redFlags: uniqueStrings(moduleDef.redFlags ?? []),
    frequency: moduleDef.frequency?.trim() || undefined,
    requiredBoxItems: uniqueStrings(moduleDef.requiredBoxItems ?? []),
  };
}

export function searchRecoveryHelper(query: string): RecoveryHelperSearchResponse {
  const normalizedQuery = normalizeQuery(query);
  const blockedMessage = blockReasonForQuery(normalizedQuery);

  if (blockedMessage) {
    return {
      query: normalizedQuery,
      blocked: true,
      message: blockedMessage,
      results: [],
    };
  }

  if (!normalizedQuery) {
    return {
      query: "",
      blocked: false,
      message: "Search for a recovery topic to see general education from the approved care library.",
      results: [],
    };
  }

  const interpretedQuery = interpretQuery(normalizedQuery);

  const ranked = Object.values(CONTENT_LIBRARY)
    .filter(isEligibleModule)
    .map((moduleDef) => ({
      moduleDef,
      score: matchScore(moduleDef, interpretedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.moduleDef.title.localeCompare(right.moduleDef.title);
    });

  const results = ranked
    .slice(0, MAX_RESULTS)
    .map((entry) => buildResult(entry.moduleDef));

  if (results.length === 0) {
    return {
      query: normalizedQuery,
      blocked: false,
      message:
        "No close matches were found in the internal recovery library. For personalized guidance, contact your clinic directly.",
      results: [],
    };
  }

  return {
    query: normalizedQuery,
    blocked: false,
    message: "Showing general recovery education from the approved care library.",
    results,
  };
}

export const RecoveryHelperService = {
  search: searchRecoveryHelper,
};
