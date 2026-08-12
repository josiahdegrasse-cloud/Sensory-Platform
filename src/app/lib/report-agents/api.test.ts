import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportAgentTask } from './types';

const { ragFetch } = vi.hoisted(() => ({ ragFetch: vi.fn() }));

vi.mock('../rag-client', () => ({ ragFetch }));

import { runReportAgent } from './api';

const task: ReportAgentTask<'evidence_auditor'> = {
  taskId: 'task-123',
  role: 'evidence_auditor',
  reportContextHash: 'context-hash-123',
  iteration: 0,
  reviewMode: 'standard',
  packet: {} as never,
};

function response(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    taskId: task.taskId,
    role: task.role,
    reportContextHash: task.reportContextHash,
    iteration: task.iteration,
    output: {},
    model: 'gpt-5.4-mini',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    ...overrides,
  }), { status: 200 });
}

describe('report agent API governance', () => {
  beforeEach(() => {
    ragFetch.mockReset();
    ragFetch.mockResolvedValue(response());
  });

  it('sends stable task identity with a bounded report deadline', async () => {
    await runReportAgent(task);

    expect(ragFetch).toHaveBeenCalledWith('/api/report-agent', expect.objectContaining({
      method: 'POST',
      timeoutMs: 180_000,
    }));
    const init = ragFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(expect.objectContaining({
      taskId: 'task-123',
      reportContextHash: 'context-hash-123',
      role: 'evidence_auditor',
      iteration: 0,
    }));
  });

  it('rejects malformed usage instead of recording impossible cost data', async () => {
    ragFetch.mockResolvedValue(response({
      usage: { inputTokens: -1, outputTokens: 5, totalTokens: 4 },
    }));

    await expect(runReportAgent(task)).rejects.toThrow(/invalid or mismatched response envelope/i);
  });
});
