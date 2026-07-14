import type { EvidenceAssistRequest, EvidenceAssistResult } from './types';
import { parseEvidenceAssistResult } from './policy';
import { ragFetch } from '../rag-client';

export async function fetchEvidenceAssist(request: EvidenceAssistRequest): Promise<EvidenceAssistResult> {
  const response = await ragFetch('/api/evidence-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Evidence Assist unavailable (${response.status}).`);
  return parseEvidenceAssistResult(await response.json());
}
