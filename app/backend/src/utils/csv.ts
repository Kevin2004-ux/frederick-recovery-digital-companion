type CsvCell = string | number | boolean | Date | null | undefined;

function normalizeCsvCell(value: CsvCell) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function escapeCsvCell(value: CsvCell) {
  const text = normalizeCsvCell(value);
  const escaped = text.replace(/"/g, "\"\"");

  if (/[",\n\r]/.test(escaped)) {
    return `"${escaped}"`;
  }

  return escaped;
}

export function toCsv(headers: string[], rows: CsvCell[][]) {
  const headerLine = headers.map((header) => escapeCsvCell(header)).join(",");
  const body = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return `${[headerLine, ...body].join("\n")}\n`;
}
