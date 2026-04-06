import PDFDocument from "pdfkit-table";
import { Response } from "express";

interface LogEntryData {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
  details?: unknown;
}

type FlattenedDetail = {
  path: string;
  value: string;
};

function toReadableLabel(path: string): string {
  return path
    .split(".")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatPrimitiveValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return null;
}

function flattenDetails(value: unknown, prefix = ""): FlattenedDetail[] {
  const primitive = formatPrimitiveValue(value);
  if (primitive !== null) {
    return prefix ? [{ path: prefix, value: primitive }] : [];
  }

  if (Array.isArray(value)) {
    const formattedValues = value
      .map((item) => formatPrimitiveValue(item))
      .filter((item): item is string => Boolean(item));

    if (formattedValues.length > 0) {
      return prefix ? [{ path: prefix, value: formattedValues.join(", ") }] : [];
    }

    return value.flatMap((item, index) =>
      flattenDetails(item, prefix ? `${prefix}.${index + 1}` : String(index + 1))
    );
  }

  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenDetails(child, prefix ? `${prefix}.${key}` : key)
  );
}

type DetailBucket = {
  label: string;
  matcher: RegExp;
};

const DETAIL_BUCKETS: DetailBucket[] = [
  {
    label: "Medication adherence / medications taken",
    matcher: /(medication.?adherence|medications?.?(taken|used)?|took.?medication|took.?meds)/i,
  },
  {
    label: "Missed doses",
    matcher: /missed.?dose|skipped?.?dose/i,
  },
  {
    label: "Side effects",
    matcher: /side.?effects?|adverse.?effects?/i,
  },
  {
    label: "Mobility / activity status",
    matcher: /mobility|activity|walking|ambulation|weight.?bearing|stairs|exercise/i,
  },
  {
    label: "Wound / incision status",
    matcher: /wound|incision|dressing|sutures?|staples?|healing/i,
  },
  {
    label: "Drainage / fever indicators",
    matcher: /drainage|drain|fever|temperature|odor|smell/i,
  },
  {
    label: "Follow-up requested",
    matcher: /follow.?up/i,
  },
  {
    label: "Red-flag symptoms",
    matcher: /red.?flags?|warning.?signs?|urgent.?symptoms?/i,
  },
];

function addBucketValue(
  bucketValues: Map<string, string[]>,
  label: string,
  value: string
) {
  const existing = bucketValues.get(label) ?? [];
  if (!existing.includes(value)) existing.push(value);
  bucketValues.set(label, existing);
}

function formatDetailsSummary(details: unknown): string {
  const flattened = flattenDetails(details);
  if (flattened.length === 0) return "--";

  const bucketValues = new Map<string, string[]>();
  const unmatched: string[] = [];

  for (const entry of flattened) {
    const bucket = DETAIL_BUCKETS.find((candidate) => candidate.matcher.test(entry.path));
    if (bucket) {
      addBucketValue(bucketValues, bucket.label, entry.value);
      continue;
    }

    unmatched.push(`${toReadableLabel(entry.path)}: ${entry.value}`);
  }

  const lines = DETAIL_BUCKETS.flatMap((bucket) => {
    const values = bucketValues.get(bucket.label);
    return values && values.length > 0
      ? [`${bucket.label}: ${values.join("; ")}`]
      : [];
  });

  if (lines.length === 0 && unmatched.length === 0) return "--";

  return [...lines, ...unmatched.slice(0, 4)].join("\n");
}

export const PdfService = {
  /**
   * Generates a PDF stream of patient logs and pipes it to the response.
   */
  async streamLogReport(entries: LogEntryData[], res: Response, userEmail: string) {
    // Cast to 'any' to bypass strict type checking for this specific library
    // which has known issues with its type definitions.
    const doc = new PDFDocument({ margin: 40, size: "A4" }) as any;

    // Pipe directly to the response so the user downloads it immediately
    doc.pipe(res);

    // Header
    doc
      .fontSize(18)
      .text("Frederick Recovery - Patient Log Report", { align: "center" });
    
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Generated for: ${userEmail}`)
      .text(`Date: ${new Date().toISOString().split("T")[0]}`);
    
    doc.moveDown(2);

    // Table Data
    const table = {
      title: "Daily Recovery Logs",
      headers: [
        { label: "Date", property: "date", width: 70 },
        { label: "Pain", property: "pain", width: 40 },
        { label: "Swelling", property: "swelling", width: 55 },
        { label: "Notes", property: "notes", width: 165 },
        { label: "Details", property: "details", width: 145 },
      ],
      datas: entries.map((e) => ({
        date: e.date,
        pain: e.painLevel.toString(),
        swelling: e.swellingLevel.toString(),
        notes: e.notes || "--",
        details: formatDetailsSummary(e.details),
      })),
    };

    // Draw Table
    await doc.table(table, {
      prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
      prepareRow: () => doc.font("Helvetica").fontSize(10),
    });

    doc.end();
  },
};
