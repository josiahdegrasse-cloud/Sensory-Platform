import { supabase } from '../supabase';
import { createConceptImageSignedUrl } from './concepts';

export interface CompletedConceptImageJob {
  id: string;
  url: string;
  mode?: string;
  storagePath?: string;
  promptStyle?: string;
  assetRole?: string;
  sourceKind?: string;
  parentImageId?: string | null;
}

const POLL_INTERVAL_MS = 2_000;
const JOB_TIMEOUT_MS = 5 * 60_000;

export async function waitForConceptImageGeneration(
  generationId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<CompletedConceptImageJob> {
  const deadline = Date.now() + (options.timeoutMs ?? JOB_TIMEOUT_MS);
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('concept_image_generations')
      .select('status, error_message, concept_images(id, image_url, storage_path, mode, prompt_style, asset_role, source_kind, parent_image_id)')
      .eq('id', generationId)
      .single();
    if (error) throw error;
    if (data.status === 'failed') {
      throw new Error(data.error_message || 'OpenAI could not complete this visual.');
    }
    if (data.status === 'completed') {
      const image = Array.isArray(data.concept_images) ? data.concept_images[0] : null;
      if (!image) throw new Error('The image job completed without a stored visual.');
      return {
        id: image.id,
        url: await createConceptImageSignedUrl(image.storage_path, image.image_url),
        mode: image.mode ?? undefined,
        storagePath: image.storage_path ?? undefined,
        promptStyle: image.prompt_style ?? undefined,
        assetRole: image.asset_role ?? undefined,
        sourceKind: image.source_kind ?? undefined,
        parentImageId: image.parent_image_id ?? null,
      };
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  const timeoutMessage = 'The image render exceeded five minutes and was stopped. Try medium quality or a simpler visual direction.';
  await supabase
    .from('concept_image_generations')
    .update({ status: 'failed', error_message: timeoutMessage, completed_at: new Date().toISOString() })
    .eq('id', generationId)
    .eq('status', 'generating');
  throw new Error(timeoutMessage);
}
