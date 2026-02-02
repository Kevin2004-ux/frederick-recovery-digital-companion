import html2pdf from "html2pdf.js";

type Profile = {
  procedureName: string;
  recoveryStartDate: string; // YYYY-MM-DD
};

type LogEntry = {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string;
  schemaVersion: number;
  details?: Record<string, unknown>;
};

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function humanValue(v: unknown): string {
  if (v === null || typeof v === "undefined") return "";
  if (typeof v === "string") return v; // no quotes
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(humanValue).filter(Boolean).join(", ");
  if (typeof v === "object") return ""; // avoid dumping objects in summary
  return String(v);
}

function pick(details: Record<string, unknown> | undefined, key: string): unknown {
  return details ? details[key] : undefined;
}

function asString(v: unknown): string {
  return humanValue(v).trim();
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => humanValue(x).trim()).filter(Boolean);
  const s = humanValue(v).trim();
  return s ? [s] : [];
}

/** Q/A renderer (scientific report style) */
function qa(question: string, answer: string | null | undefined) {
  const a = answer?.trim();
  if (!a) return "";
  return `
    <div class="qaRow">
      <div class="qaQ">${esc(question)}</div>
      <div class="qaA">${esc(a)}</div>
    </div>
  `;
}

function summarizeFromDetails(details?: Record<string, unknown>) {
  const painCompared = asString(pick(details, "painCompared"));
  const swellingToday = asString(pick(details, "swellingToday"));
  const swellingCompared = asString(pick(details, "swellingCompared"));

  const moved = asString(pick(details, "movedAsRecommended"));
  const difficulty = asString(pick(details, "difficultyActivities"));
  const tookMeds = asString(pick(details, "tookMeds"));

  const sideEffectsArr = asArray(pick(details, "sideEffects")).filter((x) => x !== "None");
  const sideEffectsOther = asString(pick(details, "sideEffectsOtherText"));
  const nonMedReliefArr = asArray(pick(details, "nonMedRelief")).filter((x) => x !== "None");

  const siteChange = asString(pick(details, "siteChange"));
  const drainage = asString(pick(details, "drainage"));
  const redFlagsArr = asArray(pick(details, "redFlags")).filter((x) => x !== "None");

  const sleepHours = asString(pick(details, "sleepHours"));
  const sleepQuality = asString(pick(details, "sleepQuality"));
  const eatNormally = asString(pick(details, "eatNormally"));
  const fluidIntake = asString(pick(details, "fluidIntake"));
  const mood = asString(pick(details, "mood"));
  const anxiety = asString(pick(details, "anxiety"));

  const sideEffects =
    sideEffectsArr.length > 0
      ? sideEffectsOther
        ? `${sideEffectsArr.join(", ")} (Other: ${sideEffectsOther})`
        : sideEffectsArr.join(", ")
      : null;

  const nonMedRelief = nonMedReliefArr.length > 0 ? nonMedReliefArr.join(", ") : null;
  const redFlags = redFlagsArr.length > 0 ? redFlagsArr.join(", ") : null;

  return {
    painCompared: painCompared || null,
    swellingToday: swellingToday || null,
    swellingCompared: swellingCompared || null,

    moved: moved || null,
    difficulty: difficulty || null,
    tookMeds: tookMeds || null,
    sideEffects,
    nonMedRelief,

    siteChange: siteChange || null,
    drainage: drainage || null,
    redFlags,

    sleepHours: sleepHours || null,
    sleepQuality: sleepQuality || null,
    eatNormally: eatNormally || null,
    fluidIntake: fluidIntake || null,
    mood: mood || null,
    anxiety: anxiety || null,
  };
}

function collectRedFlags(entries: LogEntry[]) {
  const items: Array<{ date: string; flags: string[] }> = [];

  for (const e of entries) {
    const flags = asArray(pick(e.details, "redFlags")).filter((x) => x && x !== "None");
    if (flags.length > 0) items.push({ date: e.date, flags });
  }

  const totalDays = items.length;
  const totalFlags = items.reduce((acc, it) => acc + it.flags.length, 0);

  const lines = items
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((it) => `${it.date}: ${it.flags.join(", ")}`);

  return { totalDays, totalFlags, lines };
}

export function buildClinicianReportHtml(args: {
  profile: Profile | null;
  entries: LogEntry[];
  rangeLabel: string;
}) {
  const { profile, entries, rangeLabel } = args;

  const title = "Frederick Recovery — Recovery Log Report";
  const proc = profile?.procedureName ?? "—";
  const start = profile?.recoveryStartDate ?? "—";
  const exportedAt = new Date().toISOString();

  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const rf = collectRedFlags(sorted);

  const redFlagSummary =
    rf.totalDays === 0
      ? `<div class="rfOk">
          <div class="rfTitle">Red flag summary</div>
          <div class="rfMeta">None reported in this range.</div>
        </div>`
      : `<div class="rfBox">
          <div class="rfTitle">Red flag summary</div>
          <div class="rfMeta">
            Reported on <b>${esc(String(rf.totalDays))}</b> day(s) • <b>${esc(
          String(rf.totalFlags)
        )}</b> item(s) total
          </div>
          <div class="rfList">
            ${rf.lines.map((l) => `<div class="rfLine">${esc(l)}</div>`).join("")}
          </div>
        </div>`;

  const entryBlocks = sorted
    .map((e) => {
      const notesText = e.notes?.trim() ? e.notes.trim() : "";
      const notesHtml = notesText ? esc(notesText).replaceAll("\n", "<br/>") : "—";

      const s = summarizeFromDetails(e.details);
      const hasRedFlags = Boolean(s.redFlags && s.redFlags.trim().length > 0);

      const badge = (text: string, kind: "neutral" | "warn" | "ok") => {
        const cls =
          kind === "warn" ? "pill pillWarn" : kind === "ok" ? "pill pillOk" : "pill pillNeutral";
        return `<span class="${cls}">${esc(text)}</span>`;
      };

      const painBadge =
        e.painLevel >= 8
          ? badge(`Pain ${e.painLevel}/10`, "warn")
          : badge(`Pain ${e.painLevel}/10`, "neutral");

      const swellBadge =
        e.swellingLevel >= 8
          ? badge(`Swelling ${e.swellingLevel}/10`, "warn")
          : badge(`Swelling ${e.swellingLevel}/10`, "neutral");

      const rfBadge = hasRedFlags ? badge("Red flags reported", "warn") : badge("No red flags", "ok");

      const redFlagsAnswer = hasRedFlags ? (s.redFlags ?? "") : "None reported";

      return `
<section class="entry avoidBreak">
  <div class="entryTop">
    <div class="dateCol">
      <div class="date">${esc(e.date)}</div>
      <div class="pills">
        ${painBadge}
        ${swellBadge}
        ${rfBadge}
      </div>
    </div>
  </div>

  <!-- Scientific/Q-A layout -->
  <div class="qaGrid avoidBreak">
    <div class="qaCard">
      <div class="tcTitle">Pain & swelling</div>
      ${qa("Pain level (0–10)", `${e.painLevel}/10`)}
      ${qa("Pain compared to yesterday", s.painCompared)}
      ${qa("Swelling level (0–10)", `${e.swellingLevel}/10`)}
      ${qa("Swelling today", s.swellingToday)}
      ${qa("Swelling compared to yesterday", s.swellingCompared)}
    </div>

    <div class="qaCard">
      <div class="tcTitle">Mobility & medications</div>
      ${qa("Did you move as recommended?", s.moved)}
      ${qa("Difficulty with basic activities", s.difficulty)}
      ${qa("Did you take your medications today?", s.tookMeds)}
      ${qa("Any side effects?", s.sideEffects)}
      ${qa("Non-med pain relief used", s.nonMedRelief)}
    </div>

    <div class="qaCard">
      <div class="tcTitle">Wound & safety</div>
      ${qa("Any change at the incision/site since yesterday?", s.siteChange)}
      ${qa("Any drainage observed?", s.drainage)}
      ${
        hasRedFlags
          ? `
            <div class="qaRow qaRowWarn">
              <div class="qaQ">${esc("Red flags reported")}</div>
              <div class="qaA qaAWarn">${esc(redFlagsAnswer)}</div>
            </div>
          `
          : qa("Red flags reported", redFlagsAnswer)
      }
    </div>

    <div class="qaCard">
      <div class="tcTitle">Sleep, appetite & mood</div>
      ${qa("How many hours did you sleep?", s.sleepHours ? `${s.sleepHours} hours` : null)}
      ${qa("Sleep quality", s.sleepQuality)}
      ${qa("Did you eat normally today?", s.eatNormally)}
      ${qa("Fluid intake", s.fluidIntake)}
      ${qa("Mood", s.mood)}
      ${qa("Anxiety / discouraged", s.anxiety)}
    </div>
  </div>

  <div class="notesCard avoidBreak">
    <div class="tcTitle">Patient notes</div>
    <div class="notes">${notesHtml}</div>

    <!-- Sentinel to prevent last-line clipping in html2pdf/html2canvas -->
    <div class="pdfSentinel" aria-hidden="true">.</div>
  </div>

  <!-- Tail padding INSIDE the entry prevents boundary clipping -->
  <div class="entryTailPad"></div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      margin: 0;
      background: #ffffff;
      color: #0f172a;
    }

    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      padding: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
    }

    h1 { font-size: 18px; margin: 0; }
    .sub { font-size: 12px; color:#475569; margin-top: 4px; }
    .muted { font-size: 12px; color:#64748b; }

    .grid {
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 12px;
      background: #ffffff;
    }

    .k { font-size: 11px; color:#64748b; }
    .v { margin-top: 4px; font-size: 14px; font-weight: 650; }

    .divider { height:1px; background:#e2e8f0; margin: 14px 0; }

    /* Red flag summary */
    .rfBox {
      border: 1px solid #fecaca;
      background: #fff1f2;
      border-radius: 14px;
      padding: 12px;
      margin-top: 12px;
    }
    .rfOk {
      border: 1px solid #bbf7d0;
      background: #f0fdf4;
      border-radius: 14px;
      padding: 12px;
      margin-top: 12px;
    }
    .rfTitle { font-size: 12px; font-weight: 900; color:#7f1d1d; }
    .rfOk .rfTitle { color:#14532d; }
    .rfMeta { font-size: 12px; color:#7f1d1d; margin-top: 4px; }
    .rfOk .rfMeta { color:#14532d; }
    .rfList { margin-top: 8px; }
    .rfLine {
      font-size: 12px;
      color:#7f1d1d;
      padding: 6px 8px;
      border: 1px solid #fecaca;
      border-radius: 10px;
      background: #ffffff;
      margin-top: 6px;
    }

    .pdfSentinel {
      height: 10px;
      line-height: 10px;
      font-size: 10px;
      opacity: 0;
      color: transparent;
      user-select: none;
    }

    /* Entry */
    .entry {
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 14px;
      margin: 12px 0;
      background: #ffffff;
    }

    .entryTop {
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:flex-start;
      margin-bottom: 10px;
    }

    .date { font-weight: 900; font-size: 15px; }
    .pills { margin-top: 8px; display:flex; gap:8px; flex-wrap: wrap; }

    .pill {
      display:inline-block;
      font-size: 11px;
      font-weight: 800;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #0f172a;
    }
    .pillWarn { border-color:#fecaca; background:#fff1f2; color:#7f1d1d; }
    .pillOk { border-color:#bbf7d0; background:#f0fdf4; color:#14532d; }

    .tcTitle {
      font-size: 12px;
      font-weight: 900;
      color:#0f172a;
      margin-bottom: 8px;
    }

    /* ✅ Scientific Q/A layout */
    .qaGrid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }

    .qaCard{
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
      padding: 10px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .qaRow{
      display:flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      background:#ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-top: 8px;
    }

    .qaQ{
      font-size: 12px;
      color:#475569;
      font-weight: 750;
      line-height: 1.35;
    }

    .qaA{
      font-size: 12px;
      color:#0f172a;
      font-weight: 900;
      line-height: 1.35;
      text-align: right;
      white-space: nowrap;
    }

    .qaRowWarn{
      border-color:#fecaca;
      background:#fff1f2;
    }
    .qaAWarn{
      color:#7f1d1d;
      font-weight: 950;
    }

    .notesCard {
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #ffffff;
      padding: 20px;
    }

    .notes {
      font-size: 12px;
      line-height: 1.55;
      color:#0f172a;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    /* clip-proof padding */
    .entryTailPad { height: 22px; }

    /* page break control */
    .avoidBreak {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* last-page guarantee */
    .pdfTailSpacer { height: 90px; }

    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      .qaGrid { grid-template-columns: 1fr; }
      .qaA { text-align: left; white-space: normal; }
    }

    @media print {
      .page { padding: 0; }
      body { background:#fff; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <h1>${esc(title)}</h1>
        <div class="sub">Exported: ${esc(exportedAt)} • Range: ${esc(rangeLabel)}</div>
      </div>
      <div class="muted">Patient-generated record</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="k">Procedure</div>
        <div class="v">${esc(proc)}</div>
      </div>
      <div class="card">
        <div class="k">Recovery start date</div>
        <div class="v">${esc(start)}</div>
      </div>
    </div>

    ${redFlagSummary}

    <div class="divider"></div>

    ${
      sorted.length === 0
        ? `<div class="card"><div class="k">No entries</div><div class="v">No recovery log entries in this range.</div></div>`
        : entryBlocks
    }

    <div class="pdfTailSpacer"></div>
  </div>
</body>
</html>`;
}

export async function downloadPdfReport(filename: string, html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-99999px";
  iframe.style.top = "0";
  iframe.style.width = "794px"; // A4-ish width
  iframe.style.height = "1123px"; // A4-ish height
  iframe.style.border = "0";
  iframe.style.background = "#fff";

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error("Unable to create PDF (iframe doc unavailable).");
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for layout to settle
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(() => resolve(), 350);
  });

  // Wait for fonts if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts = (doc as any).fonts;
    if (fonts?.ready) await fonts.ready;
  } catch {
    // ignore
  }

  const body = doc.body as HTMLElement;

  const opts: Record<string, unknown> = {
    margin: [10, 10, 26, 10],
    filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      letterRendering: true,
      windowWidth: 900,
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const html2pdfAny = html2pdf as unknown as any;
    await html2pdfAny().set(opts).from(body).save();
  } finally {
    document.body.removeChild(iframe);
  }
}
