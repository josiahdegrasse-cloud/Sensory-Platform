import { supabase } from '../supabase';
import { dbError, fromJson } from './shared';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export interface Template {
  id: string;
  name: string;
  attributes: string[];
  createdDate: string;
}

function toTemplate(row: Tables['templates']['Row']): Template {
  return {
    id: row.id,
    name: row.name,
    attributes: fromJson<string[]>(row.attributes) ?? [],
    createdDate: row.created_at as string,
  };
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw dbError(error);
  return (data ?? []).map(toTemplate);
}

export async function insertTemplate(name: string, attributes: string[]): Promise<Template> {
  const { data, error } = await supabase
    .from('templates')
    .insert({ name, attributes })
    .select()
    .single();
  if (error) throw dbError(error);
  return toTemplate(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw dbError(error);
}
