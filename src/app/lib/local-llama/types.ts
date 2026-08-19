export const LOCAL_LLAMA_MODELS = [
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Standard on-device writer',
    description: 'Best writing quality for modern laptops and desktops.',
    approximateDownloadMb: 1900,
    approximateVramMb: 2300,
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Lightweight on-device writer',
    description: 'Smaller local writer for devices with limited graphics memory.',
    approximateDownloadMb: 750,
    approximateVramMb: 900,
  },
] as const;

export type LocalLlamaModelId = typeof LOCAL_LLAMA_MODELS[number]['id'];

export interface LocalLlamaCapability {
  supported: boolean;
  reason: string;
  adapterLabel: string;
  storageAvailableMb: number | null;
  recommendedModelId: LocalLlamaModelId;
}

export type LocalLlamaProgressStage =
  | 'checking'
  | 'loading'
  | 'writing'
  | 'validating'
  | 'repairing'
  | 'rendering'
  | 'complete';

export interface LocalLlamaProgress {
  stage: LocalLlamaProgressStage;
  progress: number;
  message: string;
}

export interface LocalLlamaUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LocalLlamaCompletion {
  content: string;
  model: LocalLlamaModelId;
  usage: LocalLlamaUsage;
}

export interface LocalReportSections {
  executiveSummary: string;
  productPerformance: string;
  conceptDirection: string;
  commercialRecommendation: string;
  risksAndNextSteps: string;
}

export interface LocalLlamaGenerateRequest {
  modelId: LocalLlamaModelId;
  systemPrompt: string;
  userPrompt: string;
  schema: string;
  maxTokens?: number;
  temperature?: number;
}

export type LocalLlamaWorkerRequest =
  | ({ id: string; type: 'generate' } & LocalLlamaGenerateRequest)
  | { id: string; type: 'cancel' }
  | { id: string; type: 'unload' };

export type LocalLlamaWorkerResponse =
  | { id: string; type: 'load-progress'; progress: number; message: string }
  | { id: string; type: 'generation-progress'; characters: number }
  | { id: string; type: 'complete'; result: LocalLlamaCompletion }
  | { id: string; type: 'cancelled' }
  | { id: string; type: 'error'; message: string };
