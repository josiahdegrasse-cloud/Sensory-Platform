import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractLiteratureFiles } from './literature-imports';

function archive(entries: Record<string, Uint8Array>) {
  return new File([new Uint8Array(zipSync(entries)).buffer], 'papers.zip', { type: 'application/zip' });
}

describe('extractLiteratureFiles', () => {
  it('extracts PDF articles while ignoring folders and non-PDF files', async () => {
    const files = await extractLiteratureFiles(archive({
      'papers/alpha.pdf': new Uint8Array([37, 80, 68, 70]),
      'papers/notes.txt': new TextEncoder().encode('notes'),
      '__MACOSX/._alpha.pdf': new Uint8Array([1]),
    }));

    expect(files.map(file => file.name)).toEqual(['alpha.pdf']);
    expect(files[0].type).toBe('application/pdf');
  });

  it('rejects ZIP files with no PDF articles', async () => {
    await expect(extractLiteratureFiles(archive({ 'readme.txt': new Uint8Array([1]) })))
      .rejects.toThrow('does not contain any PDF');
  });

  it('keeps a direct PDF unchanged', async () => {
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'paper.pdf', { type: 'application/pdf' });
    await expect(extractLiteratureFiles(pdf)).resolves.toEqual([pdf]);
  });
});
