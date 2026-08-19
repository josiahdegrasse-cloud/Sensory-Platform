import { parseCSVLine } from '../components/stage1-instrumental-data';

export interface ParsedInstrumentalFile {
  headers: string[];
  rows: Record<string, string>[];
  sheetName?: string;
}

function normalizeHeaders(values: string[]) {
  const seen = new Map<string, number>();
  return values.map((value, index) => {
    const base = value.trim() || `Column ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function rowsFromMatrix(matrix: string[][]): ParsedInstrumentalFile {
  const headerIndex = matrix.findIndex(row => row.filter(value => value.trim()).length >= 2);
  if (headerIndex < 0) throw new Error('Could not find a header row with at least two columns.');

  const lastHeaderColumn = matrix[headerIndex].reduce(
    (last, value, index) => value.trim() ? index : last,
    -1,
  );
  if (lastHeaderColumn < 1) throw new Error('The header row must contain at least two named columns.');

  const headers = normalizeHeaders(matrix[headerIndex].slice(0, lastHeaderColumn + 1));
  const rows = matrix
    .slice(headerIndex + 1)
    .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
    .filter(row => Object.values(row).some(value => value.trim()));

  if (rows.length === 0) throw new Error('File appears to be empty or contains no data rows.');
  return { headers, rows };
}

export function parseInstrumentalCsv(text: string): ParsedInstrumentalFile {
  const matrix = text
    .split(/\r\n|\r|\n/)
    .filter(line => line.trim())
    .map(parseCSVLine);
  return rowsFromMatrix(matrix);
}

function excelCellText(cell: { value: unknown; text?: string }) {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const objectValue = value as {
      result?: unknown;
      text?: string;
      richText?: Array<{ text?: string }>;
    };
    if (objectValue.result !== undefined && objectValue.result !== null) return String(objectValue.result);
    if (objectValue.richText) return objectValue.richText.map(part => part.text ?? '').join('');
    if (objectValue.text !== undefined) return objectValue.text;
  }
  return cell.text ?? String(value);
}

export async function parseInstrumentalExcel(buffer: ArrayBuffer): Promise<ParsedInstrumentalFile> {
  const excel = (await import('exceljs')).default;
  const workbook = new excel.Workbook();
  await workbook.xlsx.load(buffer);

  for (const worksheet of workbook.worksheets) {
    const matrix: string[][] = [];
    worksheet.eachRow({ includeEmpty: false }, row => {
      const values: string[] = [];
      for (let column = 1; column <= worksheet.columnCount; column += 1) {
        values.push(excelCellText(row.getCell(column)));
      }
      matrix.push(values);
    });
    if (matrix.length < 2) continue;
    try {
      return { ...rowsFromMatrix(matrix), sheetName: worksheet.name };
    } catch {
      // Continue to the next sheet when this one is a cover or notes sheet.
    }
  }

  throw new Error('No worksheet contains a readable header and data rows.');
}

export async function parseInstrumentalFile(file: File): Promise<ParsedInstrumentalFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseInstrumentalCsv(await file.text());
  if (name.endsWith('.xlsx')) return parseInstrumentalExcel(await file.arrayBuffer());
  throw new Error('Choose a CSV or Excel (.xlsx) file.');
}
