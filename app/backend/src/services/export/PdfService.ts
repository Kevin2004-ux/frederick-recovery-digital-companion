import PDFDocument from "pdfkit-table";
import { Response } from "express";

interface LogEntryData {
  date: string;
  painLevel: number;
  swellingLevel: number;
  notes?: string | null;
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
        { label: "Date", property: "date", width: 80 },
        { label: "Pain", property: "pain", width: 50 },
        { label: "Swelling", property: "swelling", width: 60 },
        { label: "Notes", property: "notes", width: 300 },
      ],
      datas: entries.map((e) => ({
        date: e.date,
        pain: e.painLevel.toString(),
        swelling: e.swellingLevel.toString(),
        notes: e.notes || "--",
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