import { useEditorStore } from '@/stores/editor-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PropertiesPanel() {
  const {
    slides,
    activeSlideIndex,
    selectedElementId,
    updateElement,
    updateSlideBackground,
  } = useEditorStore();

  const activeSlide = slides[activeSlideIndex];
  const selectedElement = activeSlide?.elements.find(
    (el) => el.id === selectedElementId
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
    </div>
  );
}
