import { describe, expect, it } from 'vitest';
import {
  panelistKitJoinUrl,
  panelistKitManualJoinUrl,
  panelistKitPassStorageKey,
  parsePanelistKitPassTokens,
  serializePanelistKitPassTokens,
} from './panelist-kit-pass';

describe('panelist kit passes', () => {
  it('builds a unique join URL for the generated token', () => {
    expect(panelistKitJoinUrl('box/token + 1', 'https://panel.example.test')).toBe(
      'https://panel.example.test/join/box%2Ftoken%20%2B%201',
    );
  });

  it('builds the token-free manual entry URL', () => {
    expect(panelistKitManualJoinUrl('https://panel.example.test/admin')).toBe(
      'https://panel.example.test/join',
    );
  });

  it('round-trips only the kit-to-token map used for session recovery', () => {
    const tokens = { 'kit-1': 'token-one', 'kit-2': 'token-two' };
    expect(parsePanelistKitPassTokens(serializePanelistKitPassTokens(tokens))).toEqual(tokens);
    expect(panelistKitPassStorageKey('product-1')).toBe('nfi:panelist-kit-pass-batch:product-1');
  });

  it('rejects malformed or obsolete stored batches', () => {
    expect(parsePanelistKitPassTokens('{not json')).toEqual({});
    expect(parsePanelistKitPassTokens(JSON.stringify({ version: 0, tokens: { kit: 'token' } }))).toEqual({});
    expect(parsePanelistKitPassTokens(JSON.stringify({ version: 1, tokens: { kit: '', good: 'token' } }))).toEqual({ good: 'token' });
  });
});
