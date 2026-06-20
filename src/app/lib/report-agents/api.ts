import { edgeFunctionErrorMessage } from '../db/shared';
import { supabase } from '../supabase';
import type {
  ReportAgentOutputMap,
  ReportAgentRole,
  ReportAgentRunner,
  ReportAgentTask,
} from './types';

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
    || !isRecord(value.usage)) {
    throw new Error('Report agent returned an invalid or mismatched response envelope.');
  }
  return value as unknown as ReportAgentResponse<R>;
}

export interface ReportAgentUsage {
  role: ReportAgentRole;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function estimateReportAgentCost(usage: ReportAgentUsage[]): number {
  return usage.reduce((sum, item) => {
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
        const response = await runReportAgent(task);
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
): Promise<ReportAgentResponse<R>> {
  const { data, error } = await supabase.functions.invoke('run-report-agent', {
    body: {
      taskId: task.taskId,
      role: task.role,
      reportContextHash: task.reportContextHash,
      iteration: task.iteration,
      reviewMode: task.reviewMode ?? 'full',
      packet: task.packet,
    },
  });
  if (error) {
    throw new Error(await edgeFunctionErrorMessage(error, `${task.role} invocation failed.`));
  }
  return parseResponse(task, data);
}

export const reportAgentRunner: ReportAgentRunner = {
  async run<R extends ReportAgentRole>(
    task: ReportAgentTask<R>,
    _serverIgnoredOptions: { systemInstruction: string; temperature: number },
  ): Promise<ReportAgentOutputMap[R]> {
    const response = await runReportAgent(task);
    return response.output;
  },
};
