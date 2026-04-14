import { XMLParser } from "fast-xml-parser";

export type EducationArticle = {
  id: string;
  title: string;
  snippet: string;
  summary: string;
  paragraphs: string[];
  keyPoints: string[];
  url: string;
};

export type EducationSearchResult = {
  query: string;
  articles: EducationArticle[];
  cached: boolean;
};

type CacheEntry = {
  expiresAt: number;
  result: Omit<EducationSearchResult, "cached">;
};

const MEDLINEPLUS_SEARCH_URL = "https://wsearch.nlm.nih.gov/ws/query";
const MEDLINEPLUS_TOOL = "frederick-recovery-digital-companion";
const MEDLINEPLUS_RETMAX = 6;
const CACHE_TTL_MS = 1000 * 60 * 30;
const REQUEST_TIMEOUT_MS = 8000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  textNodeName: "#text",
});

const searchCache = new Map<string, CacheEntry>();

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/li>\s*<li>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/?(p|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    });
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return normalizeWhitespace(decodeEntities(stripTags(value)));
}

function extractNodeText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => extractNodeText(item)).filter(Boolean).join(" ");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;
  return Object.entries(record)
    .filter(([key]) => key !== "name")
    .map(([, child]) => extractNodeText(child))
    .filter(Boolean)
    .join(" ");
}

function getDocumentFieldMap(document: unknown): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  if (!document || typeof document !== "object") {
    return fields;
  }

  const record = document as Record<string, unknown>;
  const contents = toArray(record.content);

  for (const content of contents) {
    if (!content || typeof content !== "object") continue;

    const contentRecord = content as Record<string, unknown>;
    const rawName = typeof contentRecord.name === "string" ? contentRecord.name : "";
    const name = rawName.trim().toLowerCase();
    if (!name) continue;

    const text = cleanText(extractNodeText(content));
    if (!text) continue;

    fields[name] ??= [];
    fields[name].push(text);
  }

  return fields;
}

function pickFirstField(fields: Record<string, string[]>, names: string[]): string {
  for (const name of names) {
    const values = fields[name.toLowerCase()];
    const first = values?.find(Boolean);
    if (first) return first;
  }

  return "";
}

function sentenceSnippet(value: string, maxLength = 180): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  const firstSentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized;
  if (firstSentence.length <= maxLength) return firstSentence;

  return `${firstSentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function splitParagraphs(value: string): string[] {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean)));
}

function extractKeyPoints(paragraphs: string[], snippet: string): string[] {
  const bulletLike = dedupeStrings(
    paragraphs.flatMap((paragraph) =>
      paragraph
        .split(/\n|(?:^| )• /)
        .map((part) => normalizeWhitespace(part))
        .filter(Boolean)
    )
  ).filter((part) => part !== snippet);

  if (bulletLike.length > 0) {
    return bulletLike.slice(0, 5);
  }

  const sentenceLike = dedupeStrings(
    paragraphs.flatMap((paragraph) =>
      paragraph
        .split(/(?<=[.!?])\s+/)
        .map((part) => normalizeWhitespace(part))
        .filter(Boolean)
    )
  ).filter((part) => part !== snippet);

  return sentenceLike.slice(0, 5);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeUrlPath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function buildArticle(document: unknown, index: number): EducationArticle | null {
  const fields = getDocumentFieldMap(document);

  const title = pickFirstField(fields, ["title"]);
  const url = pickFirstField(fields, ["url"]);
  const rawSummary = pickFirstField(fields, [
    "fullsummary",
    "full-summary",
    "summary",
    "description",
  ]);

  if (!title || !url) {
    return null;
  }

  const paragraphs = splitParagraphs(rawSummary);
  const summary = paragraphs[0] ?? sentenceSnippet(rawSummary);
  const snippet = sentenceSnippet(summary || rawSummary || title);
  const finalParagraphs = paragraphs.length > 0 ? paragraphs : (summary ? [summary] : []);
  const keyPoints = extractKeyPoints(finalParagraphs, snippet);
  const fallbackIdSource =
    pickFirstField(fields, ["id", "contentid"]) || safeUrlPath(url) || `${title}-${index}`;

  return {
    id: slugify(fallbackIdSource) || `article-${index + 1}`,
    title,
    snippet,
    summary: summary || snippet,
    paragraphs: finalParagraphs,
    keyPoints,
    url,
  };
}

function collectDocuments(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return [];

  const record = parsed as Record<string, unknown>;
  const root =
    (record.nlmSearchResult as Record<string, unknown> | undefined) ??
    (record.searchResult as Record<string, unknown> | undefined) ??
    record;

  if (!root || typeof root !== "object") return [];

  const list = (root as Record<string, unknown>).list;
  if (list && typeof list === "object") {
    return toArray((list as Record<string, unknown>).document);
  }

  return toArray((root as Record<string, unknown>).document);
}

async function fetchMedlinePlusXml(query: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(MEDLINEPLUS_SEARCH_URL);
    url.searchParams.set("db", "healthTopics");
    url.searchParams.set("rettype", "brief");
    url.searchParams.set("retmax", String(MEDLINEPLUS_RETMAX));
    url.searchParams.set("tool", MEDLINEPLUS_TOOL);
    url.searchParams.set("term", query);

    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`MedlinePlus request failed with status ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchEducation(query: string): Promise<EducationSearchResult> {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return {
      query: "",
      articles: [],
      cached: false,
    };
  }

  const cacheKey = normalizedQuery.toLowerCase();
  const now = Date.now();
  const cachedEntry = searchCache.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return {
      ...cachedEntry.result,
      cached: true,
    };
  }

  const xml = await fetchMedlinePlusXml(normalizedQuery);
  const parsed = parser.parse(xml);
  const documents = collectDocuments(parsed);

  const builtArticles = documents
    .map((document, index) => buildArticle(document, index))
    .filter((article): article is EducationArticle => Boolean(article))
    .filter((article, index, all) => all.findIndex((candidate) => candidate.url === article.url) === index)
    .slice(0, MEDLINEPLUS_RETMAX);

  const resultWithoutCached = {
    query: normalizedQuery,
    articles: builtArticles,
  };

  searchCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    result: resultWithoutCached,
  });

  return {
    ...resultWithoutCached,
    cached: false,
  };
}

export const EducationService = {
  search: searchEducation,
};
