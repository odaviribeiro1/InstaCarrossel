import { getSupabaseClient } from '@/lib/supabase';
import { systemTemplates } from './system-templates';

/**
 * Seeds system templates into the database if they don't exist yet.
 * Called once during setup or on first load.
 */
export async function seedSystemTemplates(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  // Check if system templates already exist
  const { data: existing } = await client
    .from('templates')
    .select('id')
    .eq('is_system', true)
    .limit(1);

  if (existing && existing.length > 0) return;

  for (const template of systemTemplates) {
    const { data: inserted, error } = await client
      .from('templates')
      .insert({
        workspace_id: null,
        name: template.name,
        category: template.category,
        is_system: true,
        slide_count_default: template.slide_count_default,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.warn(`Falha ao inserir template ${template.name}:`, error);
      continue;
    }

    // Insert variants
    const variants = template.variants.map((v) => ({
      template_id: inserted.id,
      slide_position: v.slide_position,
      variant_name: v.variant_name,
      layout_json: v.layout_json,
    }));

    const { error: varError } = await client
      .from('template_slide_variants')
      .insert(variants);

    if (varError) {
      console.warn(`Falha ao inserir variantes de ${template.name}:`, varError);
    }
  }
}
