import { describe, expect, it } from 'vitest';
import { parseBatchSelection, encodeBatchSelection } from './project-identity';

describe('parseBatchSelection / encodeBatchSelection', () => {
  it('parses a batch: selection', () => {
    expect(parseBatchSelection('batch:abc-123')).toBe('abc-123');
  });
  it('returns null for non-batch / empty / null input', () => {
    expect(parseBatchSelection(null)).toBeNull();
    expect(parseBatchSelection(undefined)).toBeNull();
    expect(parseBatchSelection('cheese')).toBeNull();
    expect(parseBatchSelection('batch:')).toBeNull();
  });
  it('round-trips with encodeBatchSelection', () => {
    expect(parseBatchSelection(encodeBatchSelection('xyz'))).toBe('xyz');
  });
});
