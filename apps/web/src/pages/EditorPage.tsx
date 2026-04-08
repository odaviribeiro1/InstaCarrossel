import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Monitor } from 'lucide-react';
import { toast } from 'sonner';

import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { SlidePanel } from '@/components/editor/SlidePanel';
import { PropertiesPanel } from '@/components/editor/PropertiesPanel';
import { LayersPanel } from '@/components/editor/LayersPanel';
import { useEditorStore, type EditorSlide } from '@/stores/editor-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { EditorElement } from '@/stores/editor-store';

class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] p-8">
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold text-red-400">Erro no Editor</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">{this.state.error.message}</p>
            <pre className="mt-4 text-xs text-left text-[#94A3B8] bg-[rgba(59,130,246,0.04)] p-3 rounded overflow-auto max-h-40">
              {this.state.error.stack}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-[#3B82F6] text-white rounded"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { setCarouselId, setSlides } = useEditorStore();
  // Check screen size
  useEffect(() => {
    function checkSize() {
      setIsMobile(window.innerWidth < 1024);
    }
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Load carousel
  useEffect(() => {
    if (!id) return;

    async function loadCarousel() {
      const client = getSupabaseClient();
      if (!client) return;

      try {
        setCarouselId(id!);

        const { data: slidesData, error } = await client
          .from('carousel_slides')
          .select('*')
          .eq('carousel_id', id)
          .order('position', { ascending: true });

        if (error) throw error;

        if (slidesData && slidesData.length > 0) {
          const editorSlides: EditorSlide[] = slidesData.map((s) => {
            const canvas = s.canvas_json as Record<string, unknown>;
            const elements = Array.isArray(canvas.elements)
              ? canvas.elements.map((el: Record<string, unknown>, idx: number) => ({
                  id: `el_${s.id}_${idx}`,
                  type: ((el.type as string) || 'Rect') as EditorElement['type'],
                  name: `${el.type || 'Elemento'} ${idx + 1}`,
                  visible: true,
                  locked: false,
                  attrs: (el.attrs as Record<string, unknown>) || {},
                }))
              : [];

            return {
              id: s.id as string,
              position: s.position as number,
              elements,
              backgroundColor: '#ffffff',
            };
          });

          setSlides(editorSlides);
        } else {
          // Empty carousel - create one slide
          setSlides([{
            id: 'slide_new_1',
            position: 0,
            elements: [],
            backgroundColor: '#ffffff',
          }]);
        }
      } catch (err) {
        toast.error('Erro ao carregar carrossel');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    void loadCarousel();
  }, [id, setCarouselId, setSlides]);

  if (isMobile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] p-8">
        <div className="text-center">
          <Monitor className="mx-auto h-12 w-12 text-[#94A3B8]" />
          <h2 className="mt-4 text-lg font-semibold">Use no Desktop</h2>
          <p className="mt-2 text-sm text-[#94A3B8]">
            O editor de carrosseis funciona melhor em telas maiores que 1024px.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  return (
    <EditorErrorBoundary>
      <div className="flex h-screen flex-col">
        <EditorToolbar />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col">
            <div className="flex-1">
              <SlidePanel />
            </div>
            <LayersPanel />
          </div>
          <div className="flex-1">
            <EditorCanvas />
          </div>
          <PropertiesPanel />
        </div>
      </div>
    </EditorErrorBoundary>
  );
}
