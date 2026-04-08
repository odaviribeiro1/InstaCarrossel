import { Check, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import type { SlideContent } from '@/types/carousel';

interface CarouselPreviewProps {
  slides: SlideContent[];
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onUpdateSlide?: (position: number, field: keyof SlideContent, value: string) => void;
}

const typeLabels: Record<string, string> = {
  capa: 'Capa',
  conteudo: 'Conteudo',
  cta: 'CTA',
  transicao: 'Transicao',
};

export function CarouselPreview({
  slides,
  onAccept,
  onReject,
  onRegenerate,
  onUpdateSlide,
}: CarouselPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview do Carrossel</CardTitle>
        <CardDescription>
          Revise os slides gerados pela IA antes de editar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slide grid */}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {slides.map((slide) => (
            <div
              key={slide.position}
              className="group relative aspect-[4/5] overflow-hidden rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-3"
            >
              <div className="absolute left-2 top-2 rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-[#3B82F6]">
                {typeLabels[slide.type] ?? slide.type}
              </div>
              <div className="flex h-full flex-col justify-center gap-2 pt-4">
                <p className="text-center text-[11px] font-bold leading-tight line-clamp-3">
                  {slide.headline}
                </p>
                <p className="text-center text-[9px] leading-tight text-[#94A3B8] line-clamp-4">
                  {slide.body}
                </p>
                {slide.cta && (
                  <p className="text-center text-[8px] font-semibold text-[#3B82F6]">
                    {slide.cta}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Slide details — editable */}
        <div className="space-y-3">
          {slides.map((slide) => (
            <div key={slide.position} className="rounded-lg border border-[rgba(59,130,246,0.12)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(59,130,246,0.1)] text-xs font-bold text-[#3B82F6]">
                  {slide.position}
                </span>
                <span className="text-xs font-medium text-[#94A3B8]">
                  {typeLabels[slide.type] ?? slide.type}
                </span>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Titulo</label>
                <Input
                  value={slide.headline}
                  onChange={(e) => onUpdateSlide?.(slide.position, 'headline', e.target.value)}
                  className="text-sm font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">Corpo</label>
                <textarea
                  value={slide.body}
                  onChange={(e) => onUpdateSlide?.(slide.position, 'body', e.target.value)}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-[#94A3B8] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
              {slide.cta && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-[#94A3B8] uppercase tracking-wider">CTA</label>
                  <Input
                    value={slide.cta}
                    onChange={(e) => onUpdateSlide?.(slide.position, 'cta', e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReject} className="flex-1">
            <X className="mr-2 h-4 w-4" />
            Editar Prompt
          </Button>
          <Button variant="outline" onClick={onRegenerate} className="flex-1">
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerar
          </Button>
          <Button onClick={onAccept} className="flex-1">
            <Check className="mr-2 h-4 w-4" />
            Aceitar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
