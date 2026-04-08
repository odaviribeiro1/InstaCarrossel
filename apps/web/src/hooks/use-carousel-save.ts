import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '@/stores/editor-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';
import { canvasJsonSchema } from '@/types/carousel';

/**
 * Handles carousel save (manual and auto-save) with versioning.
 */
export function useCarouselSave() {
  const { slides, carouselId, setSaving, setSaveStatus } = useEditorStore();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const save = useCallback(async () => {
    if (!carouselId || !activeWorkspace) return;

    const client = getSupabaseClient();
    if (!client) return;

    setSaving(true);
    setSaveStatus('saving');

    try {
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Nao autenticado');

      // Save each slide
      for (const slide of slides) {
        const canvasJson = {
          width: 1080,
          height: 1350,
          elements: slide.elements.map((el) => ({
            type: el.type,
            attrs: el.attrs,
          })),
        };

        // Validate canvas JSON
        const validation = canvasJsonSchema.safeParse(canvasJson);
        if (!validation.success) {
          console.warn('Canvas JSON validation failed for slide:', slide.id);
          continue;
        }

        // Check size limit (5MB)
        const jsonStr = JSON.stringify(canvasJson);
        if (jsonStr.length > 5 * 1024 * 1024) {
          toast.error(`Slide ${slide.position + 1} excede o limite de 5MB`);
          continue;
        }

        await client
          .from('carousel_slides')
          .upsert(
            {
              id: slide.id,
              carousel_id: carouselId,
              workspace_id: activeWorkspace.id,
              position: slide.position,
              canvas_json: canvasJson,
            },
            { onConflict: 'id' }
          );
      }

      // Update carousel metadata
      // Fetch current version and increment atomically via single update
      const { data: currentCarousel } = await client
        .from('carousels')
        .select('version')
        .eq('id', carouselId)
        .single();

      const nextVersion = ((currentCarousel?.version as number) ?? 0) + 1;
      await client
        .from('carousels')
        .update({
          slide_count: slides.length,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        })
        .eq('id', carouselId)
        .eq('version', nextVersion - 1); // Optimistic lock — only update if version hasn't changed

      // Create version snapshot
      const snapshotJson = {
        slides: slides.map((s) => ({
          position: s.position,
          backgroundColor: s.backgroundColor,
          elements: s.elements.map((el) => ({
            type: el.type,
            attrs: el.attrs,
          })),
        })),
      };

      await client.from('carousel_versions').insert({
        carousel_id: carouselId,
        version: Date.now(),
        snapshot_json: snapshotJson,
        created_by: user.id,
      });

      setSaveStatus('saved');
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('unsaved');
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }, [slides, carouselId, activeWorkspace, setSaving, setSaveStatus]);

  // Auto-save with debounce (30 seconds)
  useEffect(() => {
    const saveStatus = useEditorStore.getState().saveStatus;
    if (saveStatus !== 'unsaved') return;

    debounceRef.current = setTimeout(() => {
      void save();
    }, 30000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slides, save]);

  return { save };
}
