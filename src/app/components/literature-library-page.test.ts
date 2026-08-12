import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { classifyLibraryUnavailableReason, paginateDocuments } from './literature-library-page';
import type { LibraryDocument } from '../lib/nfi-library';

describe('classifyLibraryUnavailableReason', () => {
  it('separates expired sessions from service outages', () => {
    expect(classifyLibraryUnavailableReason([new Error('JWT expired: 401 unauthorized')])).toBe('session');
  });

  it('identifies missing production configuration', () => {
    expect(classifyLibraryUnavailableReason([new Error('VITE_NFI_RAG_URL is required for production')])).toBe('unconfigured');
  });

  it('treats network failures as temporary', () => {
    expect(classifyLibraryUnavailableReason([new TypeError('Failed to fetch')])).toBe('temporary');
  });
});

describe('paginateDocuments', () => {
  const documents = Array.from({ length: 61 }, (_, index) => ({ documentId: `paper-${index}` })) as LibraryDocument[];

  it('renders a bounded page rather than the full corpus', () => {
    const result = paginateDocuments(documents, 2, 25);
    expect(result.items).toHaveLength(25);
    expect(result.items[0].documentId).toBe('paper-25');
    expect(result.pageCount).toBe(3);
  });

  it('clamps stale pages after filters reduce the result set', () => {
    const result = paginateDocuments(documents.slice(0, 4), 8, 25);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(4);
  });
});

describe('publication picker', () => {
  it('offers direct picker and drag-and-drop paths', async () => {
    const source = await readFile(new URL('./literature-library-page.tsx', import.meta.url), 'utf8');
    expect(source).toContain('aria-label="Choose PDF or ZIP publications"');
    expect(source).toContain("input.showPicker()");
    expect(source).toContain('onDrop={dropPublication}');
    expect(source).toContain('Browse files');
  });
});
