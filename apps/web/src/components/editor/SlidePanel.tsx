import { Plus, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/editor-store';

export function SlidePanel() {
  const {
    slides,
    activeSlideIndex,
    setActiveSlide,
    addSlide,
    duplicateSlide,
    removeSlide,
  } = useEditorStore();

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
    </div>
  );
}
