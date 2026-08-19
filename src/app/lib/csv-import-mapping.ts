export const IMPORT_FIELDS = [
  { key: 'sampleId', label: 'Sample ID', required: true, aliases: ['sampleid', 'sample', 'id', 'samplecode'] },
  { key: 'sampleName', label: 'Sample name', aliases: ['samplename', 'name', 'productname'] },
  { key: 'formulationId', label: 'Formulation ID', aliases: ['formulationid', 'formulationcode', 'formulaid', 'formulacode'] },
  { key: 'formulationName', label: 'Formulation name', aliases: ['formulation', 'formulationname', 'formulaname', 'recipe'] },
  { key: 'ingredientStatement', label: 'Ingredient statement', aliases: ['ingredientstatement', 'ingredientlist', 'ingredients'] },
  { key: 'foodType', label: 'Food type', aliases: ['foodtype', 'type', 'producttype'] },
  { key: 'category', label: 'Category', aliases: ['category', 'subcategory'] },
  { key: 'sourness', label: 'Sourness', aliases: ['sourness', 'sour', 'acid'] },
  { key: 'bitterness', label: 'Bitterness', aliases: ['bitterness', 'bitter'] },
  { key: 'saltiness', label: 'Saltiness', aliases: ['saltiness', 'salty'] },
  { key: 'umami', label: 'Umami', aliases: ['umami', 'savory', 'savoury'] },
  { key: 'sweetness', label: 'Sweetness', aliases: ['sweetness', 'sweet'] },
  { key: 'compound', label: 'GC-MS compound', aliases: ['compound', 'compoundname', 'analyte'] },
  { key: 'concentration', label: 'Concentration', aliases: ['concentration', 'concentrationppm', 'amount'] },
  { key: 'aroma', label: 'Aroma', aliases: ['aroma', 'odour', 'odor', 'descriptor'] },
  { key: 'threshold', label: 'Detection threshold', aliases: ['threshold', 'odourthreshold', 'odorthreshold'] },
  { key: 'protein', label: 'Protein', aliases: ['protein', 'proteinpercent'] },
  { key: 'fat', label: 'Fat', aliases: ['fat', 'fatpercent'] },
  { key: 'moisture', label: 'Moisture', aliases: ['moisture', 'moisturepercent'] },
  { key: 'pH', label: 'pH', aliases: ['ph'] },
  { key: 'saltContent', label: 'Salt content', aliases: ['saltcontent', 'saltpercent'] },
  { key: 'calciumMg', label: 'Calcium (mg)', aliases: ['calciummg', 'calcium'] },
] as const;

export type ImportFieldKey = typeof IMPORT_FIELDS[number]['key'];
export type ImportConversion = 'none' | 'fraction-to-percent' | 'mg-g-to-percent' | 'g-kg-to-percent';

export interface ImportColumnMapping {
  source: string;
  target: ImportFieldKey | 'ignore';
  conversion: ImportConversion;
}

export function buildImportColumnReport(
  rows: Record<string, string>[],
  mappings: ImportColumnMapping[],
) {
  const recognised: string[] = [];
  const ignored: string[] = [];
  mappings.forEach(mapping => {
    const hasNumericValue = rows.some(row => {
      const value = row[mapping.source]?.trim();
      return Boolean(value) && Number.isFinite(Number(value));
    });
    if (mapping.target !== 'ignore' || hasNumericValue) recognised.push(mapping.source);
    else ignored.push(mapping.source);
  });
  return { recognised, ignored };
}

export const RAW_IMPORT_COLUMNS = Symbol('rawImportColumns');

export type MappedImportRow = Record<string, string> & {
  [RAW_IMPORT_COLUMNS]?: Record<string, string>;
};

export function getRawImportColumns(row: Record<string, string>) {
  return (row as MappedImportRow)[RAW_IMPORT_COLUMNS];
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function inferImportMappings(headers: string[]): ImportColumnMapping[] {
  return headers.map(source => {
    const normalized = normalizeHeader(source);
    const field = IMPORT_FIELDS.find(candidate =>
      candidate.aliases.some(alias => normalized === alias)
    );
    return { source, target: field?.key ?? 'ignore', conversion: 'none' };
  });
}

function convertValue(value: string, conversion: ImportConversion) {
  if (conversion === 'none' || !value.trim()) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (conversion === 'fraction-to-percent') return String(numeric * 100);
  if (conversion === 'mg-g-to-percent') return String(numeric / 10);
  return String(numeric / 10);
}

export function applyImportMappings(
  rows: Record<string, string>[],
  mappings: ImportColumnMapping[],
) {
  return rows.map(row => {
    const rawColumns = Object.fromEntries(mappings.map(mapping => [
      mapping.source,
      convertValue(row[mapping.source] ?? '', mapping.conversion),
    ]));
    const mapped = mappings.reduce<Record<string, string>>((result, mapping) => {
    if (mapping.target !== 'ignore') {
        result[mapping.target] = rawColumns[mapping.source];
    }
      return result;
    }, {}) as MappedImportRow;
    Object.defineProperty(mapped, RAW_IMPORT_COLUMNS, {
      value: rawColumns,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return mapped;
  });
}
