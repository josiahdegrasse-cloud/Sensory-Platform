import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parseInstrumentalCsv, parseInstrumentalExcel } from './instrumental-file-import';

describe('instrumental file parsing', () => {
  it('reads CSV rows with quoted values', () => {
    const parsed = parseInstrumentalCsv('Name,Fat (%)\n"Cheddar, reference",28.5\n');
    expect(parsed.headers).toEqual(['Name', 'Fat (%)']);
    expect(parsed.rows).toEqual([{ Name: 'Cheddar, reference', 'Fat (%)': '28.5' }]);
  });

  it('skips a single-cell table title before the real CSV headers', () => {
    const parsed = parseInstrumentalCsv([
      'Table 1',
      'Name,Type,Fat (%),Hardness (g)',
      'Cheddar ref,Cheese,28.5,6706.17',
      'Mozza ref,Cheese,20.5,3986.82',
    ].join('\r\n'));

    expect(parsed.headers).toEqual(['Name', 'Type', 'Fat (%)', 'Hardness (g)']);
    expect(parsed.rows).toEqual([
      { Name: 'Cheddar ref', Type: 'Cheese', 'Fat (%)': '28.5', 'Hardness (g)': '6706.17' },
      { Name: 'Mozza ref', Type: 'Cheese', 'Fat (%)': '20.5', 'Hardness (g)': '3986.82' },
    ]);
  });

  it('reads the first populated Excel worksheet as a flat table', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Notes').getCell('A1').value = 'Cover sheet';
    const sheet = workbook.addWorksheet('Measurements');
    sheet.addRow(['Name', 'Fat (%)', 'Hardness (g)']);
    sheet.addRow(['Cheddar ref', 28.76, 6706.17]);
    sheet.addRow(['Mozza ref', 20.5, 3986.82]);
    const bytes = await workbook.xlsx.writeBuffer();
    const buffer = Uint8Array.from(bytes as unknown as ArrayLike<number>).buffer;

    const parsed = await parseInstrumentalExcel(buffer);

    expect(parsed.sheetName).toBe('Measurements');
    expect(parsed.headers).toEqual(['Name', 'Fat (%)', 'Hardness (g)']);
    expect(parsed.rows).toEqual([
      { Name: 'Cheddar ref', 'Fat (%)': '28.76', 'Hardness (g)': '6706.17' },
      { Name: 'Mozza ref', 'Fat (%)': '20.5', 'Hardness (g)': '3986.82' },
    ]);
  });
});
