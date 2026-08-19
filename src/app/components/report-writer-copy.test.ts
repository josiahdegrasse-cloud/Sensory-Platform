import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const builderSource = readFileSync(fileURLToPath(new URL('./commercialization-report-builder.tsx', import.meta.url)), 'utf8');

const userFacingSources = [
  './report-agent-review-panel.tsx',
  '../lib/local-llama/types.ts',
  '../lib/local-llama/runtime.ts',
  '../lib/local-llama/report-writer.ts',
  '../lib/local-llama/local-llama.worker.ts',
].map(path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')).concat(builderSource).join('\n');

describe('on-device report writer copy', () => {
  it('does not expose model-family branding in user-facing messages', () => {
    for (const phrase of [
      'Local Llama writes',
      'Write report with Local Llama',
      'Natural Llama-written',
      'Focused Llama corrections',
      'Local Llama is writing',
      'Llama 3.2 3B',
      'Llama 3.2 1B',
    ]) {
      expect(userFacingSources).not.toContain(phrase);
    }
  });

  it('reviews approved literature before starting the report writer', () => {
    expect(builderSource).toContain("'Review literature'");
    expect(builderSource).toContain('External literature review');
    expect(builderSource.indexOf('fetchReportGrounding(reportContext'))
      .toBeLessThan(builderSource.indexOf('runLocalLlamaReportWriter({'));
  });
});
