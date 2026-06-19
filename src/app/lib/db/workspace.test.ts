import { describe, expect, it } from 'vitest';
import { parseDriveFolderId } from './workspace';

describe('parseDriveFolderId', () => {
  it('extracts the id from a full folder URL with query params', () => {
    expect(
      parseDriveFolderId('https://drive.google.com/drive/folders/1407L5ec6M_WxkrjrF5NDNdYYxGUJHOJb?dmr=1&ec=wgc-drive-x'),
    ).toBe('1407L5ec6M_WxkrjrF5NDNdYYxGUJHOJb');
  });

  it('extracts the id from a plain folders/<id> URL', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/abc-123_DEF')).toBe('abc-123_DEF');
  });

  it('accepts a bare folder id', () => {
    expect(parseDriveFolderId('1407L5ec6M_WxkrjrF5NDNdYYxGUJHOJb')).toBe('1407L5ec6M_WxkrjrF5NDNdYYxGUJHOJb');
  });

  it('trims surrounding whitespace', () => {
    expect(parseDriveFolderId('  abc123  ')).toBe('abc123');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(parseDriveFolderId('')).toBeNull();
    expect(parseDriveFolderId('   ')).toBeNull();
  });

  it('returns null for a URL without a folders segment', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/my-drive')).toBeNull();
  });

  it('returns null for input with illegal characters and no folders segment', () => {
    expect(parseDriveFolderId('not a real id!! @#$')).toBeNull();
  });
});
