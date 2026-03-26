import {
  CONTENT_LIBRARY,
  type ModuleDefinition,
} from "./plan/contentLibrary.js";

export type NormalizedBoxItem = {
  key: string | null;
  label: string;
};

export type BoxItemEducation = {
  title: string;
  summary: string;
  instructions: string[];
  warnings: string[];
};

export type ResolvedBoxItem = {
  key: string | null;
  label: string;
  education: BoxItemEducation | null;
  educationSource: {
    type: "plan_content_library";
    moduleIds: string[];
  };
};

const ITEM_KEY_ALIASES: Record<string, string> = {
  scar_gel: "scar_gel",
  "scar gel": "scar_gel",
  scargel: "scar_gel",
  icepack: "icepack",
  "ice pack": "icepack",
  ice_pack: "icepack",
  "cold pack": "icepack",
  cold_pack: "icepack",
  compression_socks: "compression_socks",
  "compression socks": "compression_socks",
  compression_stockings: "compression_socks",
  "compression stockings": "compression_socks",
};

const ITEM_EDUCATION_MODULE_IDS: Record<string, string[]> = {
  scar_gel: ["task_scar_care"],
  icepack: ["education_ice_knee"],
  compression_socks: ["dvt_prevention_task", "knee_replacement_task"],
};

function dedupeStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  );
}

function canonicalizeItemKey(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return null;

  return ITEM_KEY_ALIASES[normalized] ?? normalized;
}

function toNormalizedBoxItem(item: unknown): NormalizedBoxItem | null {
  if (typeof item === "string") {
    const label = item.trim();
    if (!label) return null;

    return {
      key: canonicalizeItemKey(label),
      label,
    };
  }

  if (typeof item === "object" && item !== null) {
    const record = item as Record<string, unknown>;
    const label =
      typeof record.label === "string" ? record.label.trim() : "";
    const rawKey =
      typeof record.key === "string" ? record.key.trim() : "";

    if (!label) return null;

    return {
      key: canonicalizeItemKey(rawKey || label),
      label,
    };
  }

  return null;
}

export function normalizeIncludedItems(raw: unknown): NormalizedBoxItem[] {
  if (!Array.isArray(raw)) return [];

  const normalized: NormalizedBoxItem[] = [];

  for (const item of raw) {
    const normalizedItem = toNormalizedBoxItem(item);
    if (normalizedItem) normalized.push(normalizedItem);
  }

  return normalized;
}

function buildEducation(moduleDefs: ModuleDefinition[]): BoxItemEducation | null {
  if (moduleDefs.length === 0) return null;

  return {
    title: moduleDefs[0].title,
    summary: moduleDefs[0].text,
    instructions: dedupeStrings(moduleDefs.map((moduleDef) => moduleDef.text)),
    warnings: dedupeStrings(
      moduleDefs.flatMap((moduleDef) => moduleDef.redFlags ?? [])
    ),
  };
}

export function resolveBoxItems(raw: unknown): ResolvedBoxItem[] {
  return normalizeIncludedItems(raw).map((item) => {
    const moduleIds = item.key
      ? ITEM_EDUCATION_MODULE_IDS[item.key] ?? []
      : [];
    const moduleDefs = moduleIds
      .map((moduleId) => CONTENT_LIBRARY[moduleId])
      .filter(Boolean);

    return {
      key: item.key,
      label: item.label,
      education: buildEducation(moduleDefs),
      educationSource: {
        type: "plan_content_library",
        moduleIds,
      },
    };
  });
}
