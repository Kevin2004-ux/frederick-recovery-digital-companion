import PDFDocument from "pdfkit-table";
export const PdfService = {
    /**
     * Generates a PDF stream of patient logs and pipes it to the response.
     */
    async streamLogReport(entries, res, userEmail) {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
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
        // @ts-ignore
        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: () => doc.font("Helvetica").fontSize(10),
        });
        doc.end();
    },
};
