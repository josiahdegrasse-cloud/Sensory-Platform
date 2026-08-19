import { buildModeSequence, type ConceptImageMode } from '../../../../supabase/functions/_shared/concept-image-catalog.ts';
import { conceptImageErrorMessage } from './concept-image-service';

export interface GeneratedConceptImage {
  id?: string;
  url: string;
  mode?: string;
  size?: string;
  storagePath?: string;
  promptStyle?: string;
  summary?: string;
  revisedPrompt?: string;
}

interface InvokeResult {
  data: { images?: GeneratedConceptImage[]; generationId?: string; status?: string } | null;
  error: unknown;
}

export async function generateConceptImageBatch(options: {
  count: number;
  leadMode: ConceptImageMode;
  spreadModes: boolean;
  body: Record<string, unknown>;
  invoke: (body: Record<string, unknown>) => Promise<InvokeResult>;
  waitForGeneration?: (generationId: string) => Promise<GeneratedConceptImage>;
  onProgress?: (completed: number, total: number) => void;
}) {
  const modes = buildModeSequence(options.leadMode, options.count, options.spreadModes);
  let completed = 0;
  const results = await Promise.all(modes.map(async mode => {
    try {
      const result = await options.invoke({
        ...options.body,
        mode,
        count: 1,
        spreadModes: false,
      });
      if (result.error) throw result.error;
      const image = result.data?.images?.[0]
        ?? (result.data?.generationId && options.waitForGeneration
          ? await options.waitForGeneration(result.data.generationId)
          : null);
      if (!image?.url) throw new Error(`The ${mode} render returned no image.`);
      return { image, error: '' };
    } catch (error) {
      return { image: null, error: await conceptImageErrorMessage(error) };
    } finally {
      completed += 1;
      options.onProgress?.(completed, modes.length);
    }
  }));

  return {
    images: results.flatMap(result => result.image ? [result.image] : []),
    errors: results.flatMap(result => result.error ? [result.error] : []),
    requested: modes.length,
  };
}
