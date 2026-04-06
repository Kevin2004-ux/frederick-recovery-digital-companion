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

type DetailBucket = {
  key: "meds" | "mobility" | "incision" | "redFlags" | "followUp";
  matcher: RegExp;
};

type NormalizedEntryPresentation = {
  date: string;
  pain: string;
  swelling: string;
  meds: string;
  mobility: string;
  incision: string;
  redFlags: string;
  notesFull: string;
  observationsFull: string;
};

const DETAIL_BUCKETS: DetailBucket[] = [
  {
    key: "meds",
    matcher:
      /(medication.?adherence|medications?.?(taken|used)?|took.?medication|took.?meds|missed.?dose|skipped?.?dose|side.?effects?|adverse.?effects?)/i,
  },
  {
    key: "mobility",
    matcher: /mobility|activity|walking|ambulation|weight.?bearing|stairs|exercise/i,
  },
  {
    key: "incision",
    matcher: /wound|incision|dressing|sutures?|staples?|healing|drainage|drain|fever|temperature|odor|smell/i,
  },
  {
    key: "followUp",
    matcher: /follow.?up/i,
  },
  {
    key: "redFlags",
    matcher: /red.?flags?|warning.?signs?|urgent.?symptoms?|chest.?pain|short.?ness.?of.?breath|heavy.?bleeding|fever.?over.?101|face.?drooping|speech.?difficulty|confusion/i,
  },
];

function toReadableLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatPrimitiveValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? toReadableLabel(trimmed) : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return null;
}

function flattenDetails(value: unknown, prefix = ""): FlattenedDetail[] {
  const primitive = formatPrimitiveValue(value);
  if (primitive !== null) {
    return prefix ? [{ path: prefix, value: primitive }] : [];
  }

  if (Array.isArray(value)) {
    const primitiveValues = value
      .map((item) => formatPrimitiveValue(item))
      .filter((item): item is string => Boolean(item));

    if (primitiveValues.length > 0) {
      return prefix ? [{ path: prefix, value: primitiveValues.join(", ") }] : [];
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

function joinUnique(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join("; ");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function summarizeDetails(details: unknown) {
  const flattened = flattenDetails(details);
  const bucketed = {
    meds: [] as string[],
    mobility: [] as string[],
    incision: [] as string[],
    redFlags: [] as string[],
    followUp: [] as string[],
    unmatched: [] as string[],
  };

  for (const entry of flattened) {
    const matchedBucket = DETAIL_BUCKETS.find((bucket) => bucket.matcher.test(entry.path));
    if (matchedBucket) {
      bucketed[matchedBucket.key].push(entry.value);
      continue;
    }

    bucketed.unmatched.push(`${toReadableLabel(entry.path)}: ${entry.value}`);
  }

  return {
    meds: joinUnique(bucketed.meds),
    mobility: joinUnique(bucketed.mobility),
    incision: joinUnique(bucketed.incision),
    redFlags: joinUnique(bucketed.redFlags),
    followUp: joinUnique(bucketed.followUp),
    unmatched: joinUnique(bucketed.unmatched),
  };
}

function buildEntryPresentation(entry: LogEntryData): NormalizedEntryPresentation {
  const detailSummary = summarizeDetails(entry.details);
  const notesFull = entry.notes?.trim() || "--";
  const observationsFull = [detailSummary.followUp, detailSummary.unmatched]
    .filter(Boolean)
    .join(" | ");

  return {
    date: entry.date,
    pain: String(entry.painLevel),
    swelling: String(entry.swellingLevel),
    meds: truncateText(detailSummary.meds || "--", 36),
    mobility: truncateText(detailSummary.mobility || "--", 30),
    incision: truncateText(detailSummary.incision || "--", 40),
    redFlags: truncateText(detailSummary.redFlags || "--", 38),
    notesFull,
    observationsFull,
  };
}

function average(values: number[]): string {
  if (values.length === 0) return "--";
  const total = values.reduce((sum, value) => sum + value, 0);
  return (total / values.length).toFixed(1);
}

function countEntriesWithText(values: string[]): number {
  return values.filter((value) => value && value !== "--").length;
}

function drawSummaryCard(
  doc: any,
  x: number,
  y: number,
  width: number,
  title: string,
  value: string,
  subtitle?: string
) {
  doc
    .save()
    .roundedRect(x, y, width, 54, 8)
    .fillAndStroke("#F7FAFC", "#D7E3F0")
    .restore();

  doc
    .fillColor("#5B6B7A")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(title.toUpperCase(), x + 10, y + 9, { width: width - 20 });

  doc
    .fillColor("#16324F")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(value, x + 10, y + 22, { width: width - 20 });

  if (subtitle) {
    doc
      .fillColor("#6E7C8A")
      .font("Helvetica")
      .fontSize(8)
      .text(subtitle, x + 10, y + 40, { width: width - 20 });
  }
}

function ensureVerticalSpace(doc: any, requiredHeight: number) {
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight > pageBottom) {
    doc.addPage();
  }
}

function drawNotesSection(doc: any, entries: NormalizedEntryPresentation[]) {
  const notedEntries = entries.filter(
    (entry) =>
      (entry.notesFull && entry.notesFull !== "--") ||
      Boolean(entry.observationsFull)
  );

  if (notedEntries.length === 0) return;

  ensureVerticalSpace(doc, 48);
  doc.moveDown(1.2);
  doc
    .fillColor("#16324F")
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Notes & Observations", 32, doc.y);

  doc.moveDown(0.5);

  for (const entry of notedEntries) {
    const notesText = entry.notesFull && entry.notesFull !== "--" ? entry.notesFull : null;
    const observationsText = entry.observationsFull || null;
    const combinedText = [notesText, observationsText]
      .filter(Boolean)
      .join("\nObservations: ");
    const contentText = notesText && observationsText
      ? `${notesText}\nObservations: ${observationsText}`
      : notesText ?? `Observations: ${observationsText}`;
    const blockHeight =
      28 +
      doc.heightOfString(contentText, {
        width: 730,
        align: "left",
      });

    ensureVerticalSpace(doc, blockHeight + 12);

    const blockTop = doc.y;
    doc
      .save()
      .roundedRect(32, blockTop, 730, blockHeight, 8)
      .fillAndStroke("#FAFCFE", "#D7E3F0")
      .restore();

    doc
      .fillColor("#5B6B7A")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(`ENTRY ${entry.date}`, 44, blockTop + 10);

    doc
      .fillColor("#1F2933")
      .font("Helvetica")
      .fontSize(9)
      .text(contentText, 44, blockTop + 24, {
        width: 706,
        align: "left",
      });

    doc.y = blockTop + blockHeight + 12;
  }
}

export const PdfService = {
  /**
   * Generates a PDF stream of patient logs and pipes it to the response.
   */
  async streamLogReport(entries: LogEntryData[], res: Response, userEmail: string) {
    const doc = new PDFDocument({ margin: 32, size: "A4", layout: "landscape" }) as any;
    const today = new Date().toISOString().split("T")[0];
    const normalizedEntries = entries.map(buildEntryPresentation);
    const firstDate = entries[0]?.date ?? "--";
    const lastDate = entries[entries.length - 1]?.date ?? "--";
    const latestEntry = entries[entries.length - 1];

    doc.pipe(res);

    doc
      .save()
      .rect(0, 0, doc.page.width, 86)
      .fill("#16324F")
      .restore();

    doc
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("Frederick Recovery", 32, 24)
      .fontSize(12)
      .text("Recovery Log Summary", 32, 48);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#D7E3F0")
      .text(`Patient: ${userEmail}`, 540, 24, { width: 240, align: "right" })
      .text(`Generated: ${today}`, 540, 38, { width: 240, align: "right" })
      .text(`Entries: ${entries.length}`, 540, 52, { width: 240, align: "right" });

    doc
      .fillColor("#16324F")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Clinical Snapshot", 32, 108);

    const cardY = 126;
    const cardWidth = 170;
    drawSummaryCard(doc, 32, cardY, cardWidth, "Date range", `${firstDate} to ${lastDate}`);
    drawSummaryCard(doc, 220, cardY, cardWidth, "Average pain", average(entries.map((entry) => entry.painLevel)));
    drawSummaryCard(
      doc,
      408,
      cardY,
      cardWidth,
      "Average swelling",
      average(entries.map((entry) => entry.swellingLevel))
    );
    drawSummaryCard(
      doc,
      596,
      cardY,
      cardWidth,
      "Red-flag entries",
      String(countEntriesWithText(normalizedEntries.map((entry) => entry.redFlags))),
      latestEntry ? `Latest entry: ${latestEntry.date}` : "No entries yet"
    );

    doc
      .fillColor("#16324F")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("Recovery History", 32, 205);

    const table = {
      x: 32,
      y: 220,
      title: "",
      headers: [
        { label: "Date", property: "date", width: 66 },
        { label: "Pain", property: "pain", width: 38 },
        { label: "Swelling", property: "swelling", width: 52 },
        { label: "Meds", property: "meds", width: 92 },
        { label: "Mobility", property: "mobility", width: 82 },
        { label: "Incision / Wound", property: "incision", width: 108 },
        { label: "Red Flags", property: "redFlags", width: 96 },
      ],
      datas:
        normalizedEntries.length > 0
          ? normalizedEntries
          : [
              {
                date: "--",
                pain: "--",
                swelling: "--",
                meds: "--",
                mobility: "--",
                incision: "--",
                redFlags: "--",
                notesFull: "--",
                observationsFull: "",
              },
            ],
    };

    await doc.table(table, {
      prepareHeader: () =>
        doc.fillColor("#16324F").font("Helvetica-Bold").fontSize(9),
      prepareRow: (_row: unknown, indexColumn: number, indexRow: number) => {
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(indexColumn === 6 && normalizedEntries[indexRow]?.redFlags !== "--" ? "#A61B1B" : "#1F2933");
      },
      divider: {
        header: { disabled: false, width: 0.5, color: "#C8D6E5" },
        horizontal: { disabled: false, width: 0.25, color: "#E2E8F0" },
      },
    });

    drawNotesSection(doc, normalizedEntries);

    doc.end();
  },
};
