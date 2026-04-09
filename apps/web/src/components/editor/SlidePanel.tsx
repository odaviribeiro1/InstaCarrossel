import { useState } from 'react';
import { Plus, Copy, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useEditorStore, generateElementId } from '@/stores/editor-store';
import type { EditorElement } from '@/stores/editor-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';

function getSlideText(elements: EditorElement[]): string {
  return elements
    .filter((el) => el.type === 'Text' && el.attrs.text)
    .map((el) => String(el.attrs.text))
    .join('\n\n');
}

export function SlidePanel() {
  const {
    slides,
    activeSlideIndex,
    setActiveSlide,
    addSlide,
    addElementToBack,
    duplicateSlide,
    removeSlide,
  } = useEditorStore();

  const { activeWorkspace } = useWorkspaceStore();
  const activeSlide = slides[activeSlideIndex];

  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState('');

  function openAiDialog() {
    const text = activeSlide ? getSlideText(activeSlide.elements) : '';
    setAiPrompt(text);
    setAiPreview(null);
    setAiDialogOpen(true);
  }

  async function handleGenerateImage() {
    if (!aiPrompt.trim()) return;
    const client = getSupabaseClient();
    if (!client || !activeWorkspace) {
      toast.error('Workspace nao encontrado. Recarregue a pagina.');
      return;
    }

    setAiGenerating(true);
    setAiPreview(null);
    try {
      const { data, error } = await client.functions.invoke('generate-image', {
        body: { prompt: aiPrompt, workspace_id: activeWorkspace.id },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar imagem');
      const result = data as { image?: string; error?: string; model?: string };
      if (result?.error) throw new Error(result.error);
      if (!result?.image) throw new Error('Nenhuma imagem retornada');

      setAiPreview(result.image);
      setAiModel(result.model || '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    } finally {
      setAiGenerating(false);
    }
  }

  function handleApproveImage() {
    if (!aiPreview) return;
    const element: EditorElement = {
      id: generateElementId(),
      type: 'Image',
      name: 'IA Background',
      visible: true,
      locked: false,
      attrs: {
        x: 0,
        y: 0,
        width: 1080,
        height: 1350,
        src: aiPreview,
        draggable: true,
      },
    };
    addElementToBack(element);
    toast.success('Imagem inserida no slide');
    setAiDialogOpen(false);
    setAiPreview(null);
    setAiPrompt('');
  }

  return (
    <div className="flex h-full w-48 flex-col border-r glass-surface">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">Slides</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addSlide()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={`group relative cursor-pointer rounded-md border-2 transition-colors ${
              index === activeSlideIndex
                ? 'border-[rgba(59,130,246,0.4)]'
                : 'border-transparent hover:border-muted-foreground/30'
            }`}
            onClick={() => setActiveSlide(index)}
          >
            <div
              className="aspect-[4/5] rounded bg-[rgba(15,18,35,0.8)]"
              style={{ backgroundColor: slide.backgroundColor }}
            >
              <div className="flex h-full flex-col items-center justify-center p-2">
                <span className="text-[10px] font-medium text-[#94A3B8]">
                  {index + 1}
                </span>
                {slide.elements.length > 0 && (
                  <span className="text-[8px] text-[#94A3B8]">
                    {slide.elements.length} elementos
                  </span>
                )}
              </div>
            </div>
            {/* Hover actions */}
            <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                className="rounded bg-[rgba(59,130,246,0.1)] p-0.5 hover:bg-[rgba(15,18,35,0.8)]"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateSlide(index);
                }}
              >
                <Copy className="h-2.5 w-2.5" />
              </button>
              {slides.length > 1 && (
                <button
                  className="rounded bg-[rgba(59,130,246,0.1)] p-0.5 hover:bg-[rgba(15,18,35,0.8)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSlide(index);
                  }}
                >
                  <Trash2 className="h-2.5 w-2.5 text-red-400" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI Image Generation */}
      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={openAiDialog}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Gerar com IA
        </Button>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={(open) => {
        setAiDialogOpen(open);
        if (!open) setAiPreview(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Imagem com IA</DialogTitle>
            <DialogDescription>
              {aiPreview
                ? 'Revise a imagem gerada. Aprove para inserir no slide ou altere o prompt e gere novamente.'
                : 'Edite o texto abaixo e use como prompt para gerar a imagem do slide.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Preview */}
            {aiPreview && (
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-[rgba(59,130,246,0.2)]">
                  <img
                    src={aiPreview}
                    alt="Preview da imagem gerada"
                    className="w-full h-auto"
                  />
                </div>
                {aiModel && (
                  <p className="text-[10px] text-[#94A3B8] text-center">
                    Modelo: {aiModel === 'gemini-3.1-flash-image-preview' ? 'Nano Banana 2' : aiModel === 'gemini-3-pro-image-preview' ? 'Nano Banana Pro' : aiModel}
                  </p>
                )}
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">Prompt</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Descreva a imagem que deseja gerar..."
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                disabled={aiGenerating}
              />
            </div>

            {/* Actions */}
            {aiPreview ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAiPreview(null)}
                  disabled={aiGenerating}
                  className="flex-1"
                >
                  Descartar
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateImage}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="flex-1"
                >
                  {aiGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Regenerar</>
                  )}
                </Button>
                <Button
                  onClick={handleApproveImage}
                  className="flex-1"
                >
                  Inserir no Slide
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleGenerateImage}
                disabled={aiGenerating || !aiPrompt.trim()}
                className="w-full"
              >
                {aiGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Gerar Imagem</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
