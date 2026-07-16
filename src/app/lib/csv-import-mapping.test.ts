import { describe, expect, it } from 'vitest';
import { applyImportMappings, inferImportMappings } from './csv-import-mapping';

describe('CSV import mapping', () => {
  it('infers common laboratory column names', () => {
    const mappings = inferImportMappings(['Sample Code', 'Product Type', 'Protein %', 'Unknown']);
    expect(mappings.map(item => item.target)).toEqual(['sampleId', 'foodType', 'protein', 'ignore']);
  });

  it('applies unit conversions to mapped rows', () => {
    const mapped = applyImportMappings(
      [{ code: 'Y1', protein_fraction: '0.18' }],
      [
        { source: 'code', target: 'sampleId', conversion: 'none' },
        { source: 'protein_fraction', target: 'protein', conversion: 'fraction-to-percent' },
      ],
    );
    expect(mapped[0]).toEqual({ sampleId: 'Y1', protein: '18' });
  });

  it('matches aliases regardless of case, spacing, or punctuation', () => {
    const mappings = inferImportMappings(['  pH  ', 'Salt-Content', 'Odour Threshold', 'Analyte', 'Ingredient List']);
    expect(mappings.map(item => item.target)).toEqual(['pH', 'saltContent', 'threshold', 'compound', 'ingredientStatement']);
  });

  it('handles all unit conversions, including mg/g and g/kg to percent', () => {
    const mapped = applyImportMappings(
      [{ a: '50', b: '250', c: '0.4' }],
      [
        { source: 'a', target: 'fat', conversion: 'mg-g-to-percent' },
        { source: 'b', target: 'protein', conversion: 'g-kg-to-percent' },
        { source: 'c', target: 'moisture', conversion: 'fraction-to-percent' },
      ],
    );
    expect(mapped[0]).toEqual({ fat: '5', protein: '25', moisture: '40' });
  });

  it('passes empty and non-numeric values through untouched instead of producing NaN', () => {
    const mapped = applyImportMappings(
      [{ blank: '   ', junk: 'n/a', good: '0.2' }],
      [
        { source: 'blank', target: 'fat', conversion: 'fraction-to-percent' },
        { source: 'junk', target: 'protein', conversion: 'mg-g-to-percent' },
        { source: 'good', target: 'moisture', conversion: 'fraction-to-percent' },
      ],
    );
    expect(mapped[0]).toEqual({ fat: '   ', protein: 'n/a', moisture: '20' });
  });

  it('drops ignored columns and tolerates missing source columns', () => {
    const mapped = applyImportMappings(
      [{ keep: 'X1' }], // note: no `drop` and no `gap` column present in the row
      [
        { source: 'keep', target: 'sampleId', conversion: 'none' },
        { source: 'drop', target: 'ignore', conversion: 'none' },
        { source: 'gap', target: 'fat', conversion: 'none' },
      ],
    );
    expect(mapped[0]).toEqual({ sampleId: 'X1', fat: '' });
    expect(mapped[0]).not.toHaveProperty('ignore');
  });
});
