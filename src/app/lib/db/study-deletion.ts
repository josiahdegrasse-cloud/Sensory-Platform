import { supabase } from '../supabase';
import { dbError } from './shared';

export async function deleteConceptStudy(id: string): Promise<void> {
  const { error } = await supabase.from('concept_tests').delete().eq('id', id);

  if (!error) return;
  if (error.code === '23503') {
    throw new Error('This concept study is linked to a commercialization report and cannot be deleted.');
  }
  throw dbError(error);
}
