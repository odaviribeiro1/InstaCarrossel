import {
  Type,
  ImageIcon,
  Square,
  Circle,
  Triangle,
  Star,
  Minus,
  ArrowRight,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Save,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useEditorStore, generateElementId } from '@/stores/editor-store';
import type { EditorElement } from '@/stores/editor-store';
import { useCarouselSave } from '@/hooks/use-carousel-save';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';

export function EditorToolbar() {
  const {
    addElement,
    sendToBack,
    zoom,
    setZoom,
    saveStatus,
  } = useEditorStore();

  const { save } = useCarouselSave();
  const { activeWorkspace } = useWorkspaceStore();

  const imageObjectUrlRef = useRef<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  async function handleGenerateImage() {
    if (!aiPrompt.trim()) return;
    const client = getSupabaseClient();
    if (!client || !activeWorkspace) {
      toast.error('Supabase nao configurado');
      return;
    }

    setAiGenerating(true);
    try {
      const { data, error } = await client.functions.invoke('generate-image', {
        body: { prompt: aiPrompt, workspace_id: activeWorkspace.id },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar imagem');
      const result = data as { image?: string; error?: string };
      if (result?.error) throw new Error(result.error);
      if (!result?.image) throw new Error('Nenhuma imagem retornada');

      const elementId = generateElementId();
      const element: EditorElement = {
        id: elementId,
        type: 'Image',
        name: 'IA Background',
        visible: true,
        locked: false,
        attrs: {
          x: 0,
          y: 0,
          width: 1080,
          height: 1350,
          src: result.image,
          draggable: true,
        },
      };
      addElement(element);
      sendToBack(elementId);

      toast.success('Imagem gerada com sucesso');
      setAiDialogOpen(false);
      setAiPrompt('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    } finally {
      setAiGenerating(false);
    }
  }

  useEffect(() => {
    return () => {
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
      }
    };
  }, []);

  function addText() {
    const element: EditorElement = {
      id: generateElementId(),
      type: 'Text',
      name: 'Texto',
      visible: true,
      locked: false,
      attrs: {
        x: 100,
        y: 300,
        text: 'Novo texto',
        fontSize: 36,
        fontFamily: 'Inter',
        fill: '#1f2937',
        width: 880,
        align: 'center',
        draggable: true,
      },
    };
    addElement(element);
  }

  function addShape(
    type: EditorElement['type'],
    name: string,
    attrs: Record<string, unknown>
  ) {
    const element: EditorElement = {
      id: generateElementId(),
      type,
      name,
      visible: true,
      locked: false,
      attrs: {
        x: 340,
        y: 475,
        fill: '#6366f1',
        draggable: true,
        ...attrs,
      },
    };
    addElement(element);
  }

  const shapes = [
    { icon: Square, label: 'Retangulo', type: 'Rect' as const, attrs: { width: 400, height: 400 } },
    { icon: Circle, label: 'Circulo', type: 'Circle' as const, attrs: { radius: 150 } },
    { icon: Triangle, label: 'Triangulo', type: 'RegularPolygon' as const, attrs: { sides: 3, radius: 150 } },
    { icon: Star, label: 'Estrela', type: 'Star' as const, attrs: { numPoints: 5, innerRadius: 60, outerRadius: 150 } },
    { icon: Minus, label: 'Linha', type: 'Line' as const, attrs: { points: [0, 0, 400, 0], stroke: '#6366f1', strokeWidth: 4, fill: undefined } },
    { icon: ArrowRight, label: 'Seta', type: 'Arrow' as const, attrs: { points: [0, 0, 400, 0], stroke: '#6366f1', strokeWidth: 4, fill: '#6366f1' } },
  ];

  const canUndo = useEditorStore((s) => s.historyIndex >= 0);
  const canRedo = useEditorStore((s) => s.historyIndex < s.history.length - 1);

  return (
    <div className="flex items-center gap-1 border-b glass-surface px-3 py-1.5">
      {/* Add elements */}
      <Button variant="ghost" size="sm" onClick={addText} title="Adicionar texto">
        <Type className="mr-1 h-4 w-4" />
        <span className="text-xs">Texto</span>
      </Button>

      <Button variant="ghost" size="sm" title="Adicionar imagem" onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          if (imageObjectUrlRef.current) {
            URL.revokeObjectURL(imageObjectUrlRef.current);
          }
          const url = URL.createObjectURL(file);
          imageObjectUrlRef.current = url;
          const img = new window.Image();
          img.src = url;
          img.onload = () => {
            const element: EditorElement = {
              id: generateElementId(),
              type: 'Image',
              name: file.name,
              visible: true,
              locked: false,
              attrs: {
                x: 140,
                y: 200,
                width: 800,
                height: (800 / img.width) * img.height,
                src: url,
                draggable: true,
              },
            };
            addElement(element);
          };
        };
        input.click();
      }}>
        <ImageIcon className="mr-1 h-4 w-4" />
        <span className="text-xs">Imagem</span>
      </Button>

      <Button variant="ghost" size="sm" title="Gerar imagem com IA" onClick={() => setAiDialogOpen(true)}>
        <Sparkles className="mr-1 h-4 w-4" />
        <span className="text-xs">Gerar com IA</span>
      </Button>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Imagem com IA</DialogTitle>
            <DialogDescription>
              Descreva a imagem que deseja gerar. A imagem sera criada no formato 4:5 (1080x1350) e aplicada como fundo do slide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Background escuro elegante com gradiente azul e roxo, estilo tech, com formas geometricas abstratas e brilhos sutis"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              disabled={aiGenerating}
            />
            <Button
              onClick={handleGenerateImage}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="w-full"
            >
              {aiGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Imagem
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Shapes */}
      {shapes.map((shape) => (
        <Button
          key={shape.label}
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={shape.label}
          onClick={() => addShape(shape.type, shape.label, shape.attrs)}
        >
          <shape.icon className="h-3.5 w-3.5" />
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Undo/Redo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => useEditorStore.getState().undo()}
        disabled={!canUndo}
        title="Desfazer (Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => useEditorStore.getState().redo()}
        disabled={!canRedo}
        title="Refazer (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Zoom */}
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(zoom - 0.1)}>
        <ZoomOut className="h-3.5 w-3.5" />
      </Button>
      <span className="w-12 text-center text-xs text-[#94A3B8]">
        {Math.round(zoom * 100)}%
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(zoom + 0.1)}>
        <ZoomIn className="h-3.5 w-3.5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      <span className="text-xs text-[#94A3B8]">
        {saveStatus === 'saved' && 'Salvo'}
        {saveStatus === 'saving' && 'Salvando...'}
        {saveStatus === 'unsaved' && 'Nao salvo'}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Salvar" onClick={save}>
        <Save className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
