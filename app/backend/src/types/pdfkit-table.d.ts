declare module 'pdfkit-table' {
  import PDFDocument from 'pdfkit';
  
  class PDFDocumentWithTables extends PDFDocument {
    constructor(options?: any);
    table(table: any, options?: any): Promise<void>;
  }

  export = PDFDocumentWithTables;
}