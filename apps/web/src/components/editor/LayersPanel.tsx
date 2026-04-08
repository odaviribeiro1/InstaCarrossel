import { Eye, EyeOff, Lock, Unlock, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/editor-store';

export function LayersPanel() {
  const {
    slides,
    activeSlideIndex,
    selectedElementId,
    selectElement,
    toggleElementVisibility,
    toggleElementLock,
    bringToFront,
    sendToBack,
  } = useEditorStore();

  const activeSlide = slides[activeSlideIndex];
  if (!activeSlide) return null;

  // Reversed order (top layer first)
  const elements = [...activeSlide.elements].reverse();

  return (
    <div className="border-t glass-surface">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium">Camadas</span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => selectedElementId && bringToFront(selectedElementId)}
            disabled={!selectedElementId}
            title="Trazer para frente"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => selectedElementId && sendToBack(selectedElementId)}
            disabled={!selectedElementId}
            title="Enviar para tras"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="max-h-40 overflow-auto">
        {elements.map((el) => (
          <div
            key={el.id}
            className={`flex items-center gap-1 px-2 py-1 text-xs cursor-pointer hover:bg-[rgba(59,130,246,0.1)] ${
              el.id === selectedElementId ? 'bg-[rgba(59,130,246,0.1)]' : ''
            }`}
            onClick={() => selectElement(el.id)}
          >
            <button
              className="p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                toggleElementVisibility(el.id);
              }}
            >
              {el.visible ? (
                <Eye className="h-3 w-3 text-[#94A3B8]" />
              ) : (
                <EyeOff className="h-3 w-3 text-[#94A3B8]/50" />
              )}
            </button>
            <button
              className="p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                toggleElementLock(el.id);
              }}
            >
              {el.locked ? (
                <Lock className="h-3 w-3 text-[#94A3B8]" />
              ) : (
                <Unlock className="h-3 w-3 text-[#94A3B8]/50" />
              )}
            </button>
            <span className={`flex-1 truncate ${!el.visible ? 'opacity-50' : ''}`}>
              {el.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
