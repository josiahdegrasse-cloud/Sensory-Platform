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
});
