import {
  LOCAL_LLAMA_MODELS,
  type LocalLlamaCapability,
  type LocalLlamaCompletion,
  type LocalLlamaGenerateRequest,
  type LocalLlamaModelId,
  type LocalLlamaWorkerRequest,
  type LocalLlamaWorkerResponse,
} from './types';

type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter(): Promise<{ info?: { description?: string; vendor?: string } } | null>;
  };
  deviceMemory?: number;
};

let sharedWorker: Worker | null = null;

function workerInstance() {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL('./local-llama.worker.ts', import.meta.url), { type: 'module' });
  }
  return sharedWorker;
}

export async function inspectLocalLlamaCapability(): Promise<LocalLlamaCapability> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return {
      supported: false,
      reason: 'On-device report writing requires a browser with Web Worker support.',
      adapterLabel: '',
      storageAvailableMb: null,
      recommendedModelId: LOCAL_LLAMA_MODELS[1].id,
    };
  }
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'On-device report writing requires a secure HTTPS connection.',
      adapterLabel: '',
      storageAvailableMb: null,
      recommendedModelId: LOCAL_LLAMA_MODELS[1].id,
    };
  }
  const navigatorWithGpu = navigator as NavigatorWithGpu;
  if (!navigatorWithGpu.gpu) {
    return {
      supported: false,
      reason: 'This browser does not provide WebGPU. Use a current Chrome, Edge, or supported Safari version on a device with compatible graphics hardware.',
      adapterLabel: '',
      storageAvailableMb: null,
      recommendedModelId: LOCAL_LLAMA_MODELS[1].id,
    };
  }
  const adapter: Awaited<ReturnType<NonNullable<NavigatorWithGpu['gpu']>['requestAdapter']>> = await navigatorWithGpu.gpu
    .requestAdapter()
    .catch(() => null);
  if (!adapter) {
    return {
      supported: false,
      reason: 'WebGPU is available, but no compatible graphics adapter could be started.',
      adapterLabel: '',
      storageAvailableMb: null,
      recommendedModelId: LOCAL_LLAMA_MODELS[1].id,
    };
  }
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const availableBytes = estimate?.quota && estimate?.usage !== undefined ? estimate.quota - estimate.usage : null;
  const storageAvailableMb = availableBytes === null ? null : Math.max(0, Math.round(availableBytes / 1024 / 1024));
  const memoryGb = navigatorWithGpu.deviceMemory ?? null;
  const recommendedModelId: LocalLlamaModelId = memoryGb !== null && memoryGb < 8
    ? LOCAL_LLAMA_MODELS[1].id
    : LOCAL_LLAMA_MODELS[0].id;
  const description = adapter.info?.description || adapter.info?.vendor || 'WebGPU graphics adapter';
  return {
    supported: true,
    reason: 'Local report writing is available on this device.',
    adapterLabel: description,
    storageAvailableMb,
    recommendedModelId,
  };
}

export function runLocalLlamaCompletion(
  request: LocalLlamaGenerateRequest,
  options: {
    signal?: AbortSignal;
    onLoadProgress?: (progress: number, message: string) => void;
    onGenerationProgress?: (characters: number) => void;
  } = {},
): Promise<LocalLlamaCompletion> {
  const worker = workerInstance();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      options.signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      const cancel: LocalLlamaWorkerRequest = { id, type: 'cancel' };
      worker.postMessage(cancel);
      cleanup();
      reject(new DOMException('On-device report generation was cancelled.', 'AbortError'));
    };
    const onMessage = (event: MessageEvent<LocalLlamaWorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === 'load-progress') options.onLoadProgress?.(message.progress, message.message);
      if (message.type === 'generation-progress') options.onGenerationProgress?.(message.characters);
      if (message.type === 'complete') {
        cleanup();
        resolve(message.result);
      }
      if (message.type === 'error') {
        cleanup();
        reject(new Error(message.message));
      }
      if (message.type === 'cancelled') {
        cleanup();
        reject(new DOMException('On-device report generation was cancelled.', 'AbortError'));
      }
    };
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    worker.addEventListener('message', onMessage);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const message: LocalLlamaWorkerRequest = { id, type: 'generate', ...request };
    worker.postMessage(message);
  });
}

export function unloadLocalLlama() {
  if (!sharedWorker) return;
  const message: LocalLlamaWorkerRequest = { id: crypto.randomUUID(), type: 'unload' };
  sharedWorker.postMessage(message);
  sharedWorker.terminate();
  sharedWorker = null;
}
