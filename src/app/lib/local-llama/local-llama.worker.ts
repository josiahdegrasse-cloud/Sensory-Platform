/// <reference lib="webworker" />

import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';
import type {
  LocalLlamaModelId,
  LocalLlamaWorkerRequest,
  LocalLlamaWorkerResponse,
} from './types';

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let engine: MLCEngine | null = null;
let loadedModelId: LocalLlamaModelId | null = null;
let activeRequestId: string | null = null;

function send(message: LocalLlamaWorkerResponse) {
  workerScope.postMessage(message);
}

async function loadModel(id: string, modelId: LocalLlamaModelId) {
  if (engine && loadedModelId === modelId) return engine;
  if (engine) await engine.unload();
  engine = await CreateMLCEngine(modelId, {
    logLevel: 'ERROR',
    initProgressCallback: report => send({
      id,
      type: 'load-progress',
      progress: Math.max(0, Math.min(1, report.progress)),
      message: 'Preparing the on-device writer…',
    }),
  });
  loadedModelId = modelId;
  return engine;
}

workerScope.onmessage = async (event: MessageEvent<LocalLlamaWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'cancel') {
    if (activeRequestId === request.id && engine) await engine.interruptGenerate();
    send({ id: request.id, type: 'cancelled' });
    return;
  }
  if (request.type === 'unload') {
    if (engine) await engine.unload();
    engine = null;
    loadedModelId = null;
    send({ id: request.id, type: 'cancelled' });
    return;
  }

  activeRequestId = request.id;
  try {
    const localEngine = await loadModel(request.id, request.modelId);
    let content = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const stream = await localEngine.chat.completions.create({
      model: request.modelId,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
      response_format: { type: 'json_object', schema: request.schema },
      temperature: request.temperature ?? 0.55,
      top_p: 0.9,
      repetition_penalty: 1.08,
      max_tokens: request.maxTokens ?? 1800,
      stream: true,
      stream_options: { include_usage: true },
    });
    for await (const chunk of stream) {
      content += chunk.choices[0]?.delta.content ?? '';
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }
      send({ id: request.id, type: 'generation-progress', characters: content.length });
    }
    send({
      id: request.id,
      type: 'complete',
      result: { content, model: request.modelId, usage },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The on-device writer could not complete the report.';
    if (/abort|interrupt/i.test(message)) send({ id: request.id, type: 'cancelled' });
    else send({ id: request.id, type: 'error', message });
  } finally {
    if (activeRequestId === request.id) activeRequestId = null;
  }
};

export {};
