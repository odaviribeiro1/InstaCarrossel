import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore, generateElementId } from '@/stores/editor-store';
import type { EditorElement } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';

function getSlideText(elements: EditorElement[]): string {
  return elements
    .filter((el) => el.type === 'Text' && el.attrs.text)
    .map((el) => String(el.attrs.text))
    .join('\n\n');
}

export function PropertiesPanel() {
  const {
    slides,
    activeSlideIndex,
    selectedElementId,
    updateElement,
    updateSlideBackground,
    addElementToBack,
  } = useEditorStore();

  const { activeWorkspace } = useWorkspaceStore();

  const activeSlide = slides[activeSlideIndex];
  const selectedElement = activeSlide?.elements.find(
    (el) => el.id === selectedElementId
  );

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
    // Save reference before clearing state
    const imageSrc = aiPreview;
    // Close dialog first, then insert after a tick to avoid React batching issues
    setAiDialogOpen(false);
    setAiPreview(null);
    setAiPrompt('');
    // Use setTimeout to ensure dialog state is settled before modifying store
    setTimeout(() => {
      const element: EditorElement = {
        id: generateElementId(),
        type: 'Image',
        name: 'IA Background',
        visible: true,
        locked: false,
        attrs: { x: 0, y: 0, width: 1080, height: 1350, src: imageSrc, draggable: true },
      };
      addElementToBack(element);
      toast.success('Imagem inserida no slide');
    }, 100);
  }

  const aiButton = (
    <>
      <div className="border-t mt-3 pt-3">
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={openAiDialog}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Gerar com IA
        </Button>
      </div>
      <Dialog open={aiDialogOpen} onOpenChange={(open) => { setAiDialogOpen(open); if (!open) setAiPreview(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Imagem com IA</DialogTitle>
            <DialogDescription>
              {aiPreview ? 'Revise a imagem. Aprove para inserir ou altere o prompt.' : 'Edite o texto e use como prompt para gerar a imagem.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {aiPreview && (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-[rgba(59,130,246,0.2)]">
                  <img src={aiPreview} alt="Preview" className="w-full h-auto" />
                </div>
                {aiModel && (
                  <p className="text-[10px] text-[#94A3B8] text-center">
                    Modelo: {aiModel === 'gemini-3.1-flash-image-preview' ? 'Nano Banana 2' : aiModel === 'gemini-3-pro-image-preview' ? 'Nano Banana Pro' : aiModel}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8]">Prompt</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Descreva a imagem..."
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                disabled={aiGenerating}
              />
            </div>
            {aiPreview ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAiPreview(null)} disabled={aiGenerating} className="flex-1">Descartar</Button>
                <Button variant="outline" onClick={handleGenerateImage} disabled={aiGenerating || !aiPrompt.trim()} className="flex-1">
                  {aiGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : <><Sparkles className="mr-2 h-4 w-4" />Regenerar</>}
                </Button>
                <Button onClick={handleApproveImage} className="flex-1">Inserir no Slide</Button>
              </div>
            ) : (
              <Button onClick={handleGenerateImage} disabled={aiGenerating || !aiPrompt.trim()} className="w-full">
                {aiGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : <><Sparkles className="mr-2 h-4 w-4" />Gerar Imagem</>}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!selectedElement) {
    // Show slide properties
    return (
      <div className="w-64 border-l glass-surface p-3">
        <h3 className="mb-3 text-sm font-semibold">Propriedades do Slide</h3>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cor de Fundo</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={activeSlide?.backgroundColor ?? '#ffffff'}
                onChange={(e) => updateSlideBackground(e.target.value)}
                className="h-8 w-12 cursor-pointer rounded border"
              />
              <Input
                value={activeSlide?.backgroundColor ?? '#ffffff'}
                onChange={(e) => updateSlideBackground(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="text-xs text-[#94A3B8]">
            {activeSlide?.elements.length ?? 0} elementos
          </div>
        </div>
        {aiButton}
      </div>
    );
  }

  function updateAttr(key: string, value: unknown) {
    if (selectedElementId) {
      updateElement(selectedElementId, { [key]: value });
    }
  }

  const attrs = selectedElement.attrs;

  return (
    <div className="w-64 overflow-auto border-l glass-surface p-3">
      <h3 className="mb-3 text-sm font-semibold">{selectedElement.name}</h3>
      <div className="space-y-3">
        {/* Position */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">X</Label>
            <Input
              type="number"
              value={Math.round(Number(attrs.x) || 0)}
              onChange={(e) => updateAttr('x', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Y</Label>
            <Input
              type="number"
              value={Math.round(Number(attrs.y) || 0)}
              onChange={(e) => updateAttr('y', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Largura</Label>
            <Input
              type="number"
              value={Math.round(Number(attrs.width) || 0)}
              onChange={(e) => updateAttr('width', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Altura</Label>
            <Input
              type="number"
              value={Math.round(Number(attrs.height) || 0)}
              onChange={(e) => updateAttr('height', Number(e.target.value))}
              className="h-7 text-xs"
            />
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-1">
          <Label className="text-[10px]">Rotacao</Label>
          <Input
            type="number"
            value={Math.round(Number(attrs.rotation) || 0)}
            onChange={(e) => updateAttr('rotation', Number(e.target.value))}
            className="h-7 text-xs"
          />
        </div>

        {/* Opacity */}
        <div className="space-y-1">
          <Label className="text-[10px]">Opacidade</Label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={attrs.opacity != null ? Number(attrs.opacity) : 1}
            onChange={(e) => updateAttr('opacity', Number(e.target.value))}
            className="w-full"
          />
          <span className="text-[10px] text-[#94A3B8]">
            {Math.round((attrs.opacity != null ? Number(attrs.opacity) : 1) * 100)}%
          </span>
        </div>

        {/* Text-specific */}
        {selectedElement.type === 'Text' && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px]">Texto</Label>
              <textarea
                value={String(attrs.text ?? '')}
                onChange={(e) => updateAttr('text', e.target.value)}
                className="flex min-h-[60px] w-full rounded-md border border-[rgba(59,130,246,0.2)] bg-[#0A0A0F] px-2 py-1 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Fonte</Label>
              <Input
                value={String(attrs.fontFamily ?? 'Inter')}
                onChange={(e) => updateAttr('fontFamily', e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Tamanho</Label>
                <Input
                  type="number"
                  value={Number(attrs.fontSize) || 16}
                  onChange={(e) => updateAttr('fontSize', Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Cor</Label>
                <input
                  type="color"
                  value={String(attrs.fill ?? '#000000')}
                  onChange={(e) => updateAttr('fill', e.target.value)}
                  className="h-7 w-full cursor-pointer rounded border"
                />
              </div>
            </div>
            <div className="flex gap-1">
              {['left', 'center', 'right'].map((align) => (
                <button
                  key={align}
                  className={`flex-1 rounded border px-2 py-1 text-[10px] ${
                    attrs.align === align ? 'bg-[rgba(59,130,246,0.1)] border-[rgba(59,130,246,0.4)]' : ''
                  }`}
                  onClick={() => updateAttr('align', align)}
                >
                  {align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Shape-specific */}
        {(selectedElement.type === 'Rect' ||
          selectedElement.type === 'Circle' ||
          selectedElement.type === 'Star' ||
          selectedElement.type === 'RegularPolygon') && (
          <>
            <div className="space-y-1">
              <Label className="text-[10px]">Cor de Preenchimento</Label>
              <input
                type="color"
                value={String(attrs.fill ?? '#6366f1')}
                onChange={(e) => updateAttr('fill', e.target.value)}
                className="h-7 w-full cursor-pointer rounded border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Borda</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={String(attrs.stroke ?? '#000000')}
                  onChange={(e) => updateAttr('stroke', e.target.value)}
                  className="h-7 w-12 cursor-pointer rounded border"
                />
                <Input
                  type="number"
                  min={0}
                  value={Number(attrs.strokeWidth) || 0}
                  onChange={(e) => updateAttr('strokeWidth', Number(e.target.value))}
                  className="h-7 flex-1 text-xs"
                  placeholder="Espessura"
                />
              </div>
            </div>
            {selectedElement.type === 'Rect' && (
              <div className="space-y-1">
                <Label className="text-[10px]">Raio da Borda</Label>
                <Input
                  type="number"
                  min={0}
                  value={Number(attrs.cornerRadius) || 0}
                  onChange={(e) => updateAttr('cornerRadius', Number(e.target.value))}
                  className="h-7 text-xs"
                />
              </div>
            )}
          </>
        )}
      </div>
      {aiButton}
    </div>
  );
}
