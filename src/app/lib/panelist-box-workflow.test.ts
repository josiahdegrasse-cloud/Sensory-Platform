import { describe, expect, it } from 'vitest';
import type { Product } from '../data/survey-domain';
import { analyzePackList, boxBatchSize, normalizeBoxCode, recipientInputs, sampleCue, taskSummariesForIds } from './panelist-box-workflow';

const baseProduct: Product = {
  id: 'product-1',
  name: 'Cheddar trial',
  category: 'Cheese',
  createdDate: '2026-06-28',
  status: 'active',
};

describe('panelist box workflow helpers', () => {
  it('normalizes fallback codes for phone entry', () => {
    expect(normalizeBoxCode(' nfi-8f2k 1a3b ')).toBe('NFI-8F2K1A3B');
  });

  it('uses recipient rows for named batches and clamps unassigned batches', () => {
    expect(boxBatchSize('named', 8, 12)).toBe(8);
    expect(boxBatchSize('named', 0, 12)).toBe(0);
    expect(boxBatchSize('unnamed', 8, 300)).toBe(250);
    expect(boxBatchSize('unnamed', 0, 0)).toBe(1);
  });

  it('parses pack-list names and emails with validation issues', () => {
    const analysis = analyzePackList([
      'Avery Johnson, avery@example.com',
      'Mina Patel <mina@example.com>',
      'Bad Email <bad@>',
      'Duplicate Person, avery@example.com',
      'Chris Wong',
    ].join('\n'));

    expect(recipientInputs(analysis.recipients)).toEqual([
      { name: 'Avery Johnson', email: 'avery@example.com' },
      { name: 'Mina Patel', email: 'mina@example.com' },
      { name: 'Bad Email bad@' },
      { name: 'Duplicate Person', email: 'avery@example.com' },
      { name: 'Chris Wong' },
    ]);
    expect(analysis.hasErrors).toBe(true);
    expect(analysis.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
      'Line 3 has an email that does not look valid.',
      'Lines 1 and 4 use the same email.',
      'Line 5 has no email. The insert can print, but follow-up will be harder.',
    ]));
  });

  it('derives sample cues for single, blinded, and multi-sample tasks', () => {
    expect(sampleCue(baseProduct)).toBe('Single packaged sample');
    expect(sampleCue({ ...baseProduct, blinded: true, blindCode: 'A42' })).toBe('Sample A42');
    expect(sampleCue({
      ...baseProduct,
      isMultiSample: true,
      samples: [
        { id: 's1', code: 'A', label: 'Sample A' },
        { id: 's2', code: 'B', label: 'Sample B' },
      ],
    })).toBe('Samples A, B');
  });

  it('returns task summaries in assigned box order with fallback product support', () => {
    const secondProduct: Product = {
      ...baseProduct,
      id: 'product-2',
      name: 'Yogurt concept',
      category: 'Yogurt',
      isMultiSample: true,
      samples: [
        { id: 's1', code: '101', label: 'Prototype 101' },
        { id: 's2', code: '102', label: 'Prototype 102' },
        { id: 's3', code: '103', label: 'Prototype 103' },
      ],
    };

    expect(taskSummariesForIds([baseProduct, secondProduct], ['product-2', 'product-1'])).toMatchObject([
      { id: 'product-2', label: 'Yogurt concept', sampleCue: 'Samples 101, 102, 103', estimate: '15-20 min' },
      { id: 'product-1', label: 'Cheddar trial', sampleCue: 'Single packaged sample', estimate: '10-15 min' },
    ]);
    expect(taskSummariesForIds([], ['product-1'], baseProduct)).toMatchObject([
      { id: 'product-1', label: 'Cheddar trial' },
    ]);
  });
});
