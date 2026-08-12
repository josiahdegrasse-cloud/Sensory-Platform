import type {
  ReportAgentOutputMap,
  ReportAgentRole,
  ReportAgentRunner,
  ReportAgentTask,
} from './types';
import { ragFetch } from '../rag-client';

export interface ReportAgentResponse<R extends ReportAgentRole> {
  taskId: string;
  role: R;
  reportContextHash: string;
  iteration: number;
  output: ReportAgentOutputMap[R];
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResponse<R extends ReportAgentRole>(
  task: ReportAgentTask<R>,
  value: unknown,
): ReportAgentResponse<R> {
  if (!isRecord(value)
    || value.taskId !== task.taskId
    || value.role !== task.role
    || value.reportContextHash !== task.reportContextHash
    || value.iteration !== task.iteration
    || !isRecord(value.output)
    || typeof value.model !== 'string'
    || !isRecord(value.usage)
    || !validUsage(value.usage)) {
    throw new Error('Report agent returned an invalid or mismatched response envelope.');
  }
  return value as unknown as ReportAgentResponse<R>;
}

function validUsage(value: Record<string, unknown>): boolean {
  const fields = ['inputTokens', 'outputTokens', 'totalTokens'] as const;
  if (!fields.every(field => Number.isFinite(value[field]) && Number(value[field]) >= 0)) return false;
  return Number(value.totalTokens) >= Number(value.inputTokens)
    && Number(value.totalTokens) >= Number(value.outputTokens);
}

export interface ReportAgentUsage {
  role: ReportAgentRole;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export function isOllamaReportAgentModel(model: string): boolean {
  return /^ollama:/i.test(model);
}

export function isLocalGenerativeReportAgentModel(model: string): boolean {
  return /^(?:ollama|llama_cpp):/i.test(model);
}

const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  local_deterministic_agent: { input: 0, output: 0 },
  local_deterministic_ollama_unavailable: { input: 0, output: 0 },
  'ollama:llama3.2:3b': { input: 0, output: 0 },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function estimateReportAgentCost(usage: ReportAgentUsage[]): number {
  return usage.reduce((sum, item) => {
    if (/^(local_|ollama:|llama_cpp:)/i.test(item.model)) return sum;
    const pricing = MODEL_PRICING_PER_MILLION[item.model] ?? MODEL_PRICING_PER_MILLION['gpt-5.4'];
    return sum
      + item.inputTokens / 1_000_000 * pricing.input
      + item.outputTokens / 1_000_000 * pricing.output;
  }, 0);
}

export function createMeteredReportAgentRunner(): {
  runner: ReportAgentRunner;
  usage: ReportAgentUsage[];
} {
  const usage: ReportAgentUsage[] = [];
  return {
    usage,
    runner: {
      async run<R extends ReportAgentRole>(
        task: ReportAgentTask<R>,
        _serverIgnoredOptions: { systemInstruction: string; temperature: number },
      ): Promise<ReportAgentOutputMap[R]> {
        const response = await runReportAgent(task, _serverIgnoredOptions);
        usage.push({
          role: task.role,
          model: response.model,
          inputTokens: Number(response.usage.inputTokens ?? 0),
          outputTokens: Number(response.usage.outputTokens ?? 0),
          totalTokens: Number(response.usage.totalTokens ?? 0),
        });
        return response.output;
      },
    },
  };
}

export async function runReportAgent<R extends ReportAgentRole>(
  task: ReportAgentTask<R>,
  options?: { systemInstruction?: string; temperature?: number },
): Promise<ReportAgentResponse<R>> {
  const response = await ragFetch('/api/report-agent', {
    method: 'POST',
    timeoutMs: 180_000,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      taskId: task.taskId,
      role: task.role,
      reportContextHash: task.reportContextHash,
      iteration: task.iteration,
      reviewMode: task.reviewMode ?? 'full',
      packet: task.packet,
      systemInstruction: options?.systemInstruction ?? '',
      temperature: options?.temperature ?? 0.2,
    }),
  });
  if (!response.ok) throw new Error(`${task.role} local report agent failed (${response.status}).`);
  const data = await response.json();
  return parseResponse(task, data);
}

export const reportAgentRunner: ReportAgentRunner = {
  async run<R extends ReportAgentRole>(
    task: ReportAgentTask<R>,
    options: { systemInstruction: string; temperature: number },
  ): Promise<ReportAgentOutputMap[R]> {
    const response = await runReportAgent(task, options);
    return response.output;
  },
};
