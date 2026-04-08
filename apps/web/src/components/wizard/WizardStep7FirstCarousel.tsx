import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, RefreshCw, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useWizardStore } from '@/stores/wizard-store';
import { getSupabaseClient } from '@/lib/supabase';

interface MockSlide {
  position: number;
  type: string;
  headline: string;
  body: string;
}

export function WizardStep7FirstCarousel() {
  const { setCurrentStep } = useWizardStore();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [slides, setSlides] = useState<MockSlide[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);

  async function generate() {
    if (!topic.trim()) {
      toast.error('Insira um tema para gerar o carrossel');
      return;
    }

    setIsGenerating(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      // Try calling the generate-content Edge Function
      const { data, error } = await client.functions.invoke('generate-content', {
        body: {
          topic,
          slide_count: 5,
          category: 'educacional',
        },
      });

      if (error || !data) {
        // Fallback: generate mock slides
        setSlides([
          { position: 1, type: 'capa', headline: topic, body: 'Descubra tudo sobre este tema' },
          { position: 2, type: 'conteudo', headline: 'Ponto 1', body: 'Primeiro ponto importante sobre o tema que vale a pena conhecer.' },
          { position: 3, type: 'conteudo', headline: 'Ponto 2', body: 'Segundo aspecto relevante que pode transformar sua perspectiva.' },
          { position: 4, type: 'conteudo', headline: 'Ponto 3', body: 'Terceiro elemento fundamental para dominar o assunto.' },
          { position: 5, type: 'cta', headline: 'Gostou?', body: 'Salve este post e compartilhe com quem precisa!' },
        ]);
        toast.info('Carrossel gerado com dados de demonstracao.');
      } else {
        const result = data as { slides: MockSlide[] };
        setSlides(result.slides || []);
        toast.success('Carrossel gerado com IA');
      }
    } catch {
      // Fallback mock
      setSlides([
        { position: 1, type: 'capa', headline: topic, body: 'Descubra tudo sobre este tema' },
        { position: 2, type: 'conteudo', headline: 'Introducao', body: 'Tudo que voce precisa saber sobre o assunto.' },
        { position: 3, type: 'conteudo', headline: 'Desenvolvimento', body: 'Aprofundando no tema com insights valiosos.' },
        { position: 4, type: 'conteudo', headline: 'Conclusao', body: 'Resumindo os pontos mais importantes.' },
        { position: 5, type: 'cta', headline: 'Acao!', body: 'Compartilhe e salve para consultar depois!' },
      ]);
      toast.info('Carrossel de demonstracao gerado.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function accept() {
    setIsAccepting(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        await client
          .from('platform_config')
          .update({ setup_completed: true, setup_step: 7 })
          .not('id', 'is', null);
      }

      toast.success('Setup completo! Bem-vindo a plataforma.');
      // Force reload to exit wizard
      window.location.href = '/';
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar setup');
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Sparkles className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Primeiro Carrossel</CardTitle>
            <CardDescription>
              Teste a geracao de carrosseis com IA para validar o setup.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="topic">Tema do Carrossel</Label>
          <div className="flex gap-2">
            <Input
              id="topic"
              placeholder="Ex: 5 dicas de produtividade"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <Button onClick={generate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Preview slides */}
        {slides.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Preview dos Slides</p>
            <div className="grid grid-cols-5 gap-2">
              {slides.map((slide) => (
                <div
                  key={slide.position}
                  className="aspect-[4/5] rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-3 flex flex-col justify-between"
                >
                  <div>
                    <p className="text-[10px] font-bold leading-tight line-clamp-2">
                      {slide.headline}
                    </p>
                  </div>
                  <p className="text-[8px] text-[#94A3B8] leading-tight line-clamp-3">
                    {slide.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={generate} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerar
              </Button>
              <Button onClick={accept} className="flex-1" disabled={isAccepting}>
                {isAccepting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Aceitar e Finalizar
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep(6)}
            className="flex-1"
          >
            Voltar
          </Button>
          {slides.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={accept}
              className="flex-1"
            >
              Pular e Finalizar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
