import type { Product } from '../data/survey-domain';
import type { SurveySection } from './survey-sections';

// Configure and assign every draft before making any survey visible. Keep the
// successful IDs so a retry after partial activation does not relaunch them.
export async function launchSurveyBatch({
  products, sections, panelistIds, sentIds, update, assign, onActivated,
}: {
  products: Product[];
  sections: SurveySection[];
  panelistIds: string[];
  sentIds: Set<string>;
  update: (id: string, updates: Partial<Product>) => Promise<unknown>;
  assign: (productIds: string[], panelistIds: string[]) => Promise<unknown>;
  onActivated: (count: number) => void;
}) {
  if (!products.length || !sections.length || !panelistIds.length) {
    throw new Error('Choose surveys, sections, and eligible panelists before sending.');
  }
  const pending = products.filter(product => !sentIds.has(product.id));
  const nonDraft = pending.find(product => product.status !== 'draft');
  if (nonDraft) throw new Error(`${nonDraft.name} is no longer a draft. Configure active surveys individually.`);
  for (const product of pending) {
    await update(product.id, { surveySections: sections });
  }
  await assign(pending.map(product => product.id), panelistIds);
  for (const product of pending) {
    await update(product.id, { status: 'active' });
    sentIds.add(product.id);
    onActivated(sentIds.size);
  }
}
