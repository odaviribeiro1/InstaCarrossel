import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  FileText,
  Link,
  Youtube,
  Instagram,
  Twitter,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CarouselPreview } from '@/components/preview/CarouselPreview';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';
import { generatedContentSchema } from '@/types/carousel';
import type { SlideContent } from '@/types/carousel';

type ContentSource = 'text' | 'url' | 'youtube' | 'reels' | 'twitter';

const configSchema = z.object({
  topic: z.string().min(1, 'Tema e obrigatorio'),
  toneOfVoice: z.string().optional(),
  audience: z.string().optional(),
  slideCount: z.number().min(3).max(15),
  category: z.enum(['educacional', 'vendas', 'storytelling', 'antes_depois', 'lista']),
});

type ConfigFormValues = z.infer<typeof configSchema>;

const sourceIcons: Record<ContentSource, typeof FileText> = {
  text: FileText,
  url: Link,
  youtube: Youtube,
  reels: Instagram,
  twitter: Twitter,
};

const sourceLabels: Record<ContentSource, string> = {
  text: 'Texto Livre',
  url: 'URL de Blog',
  youtube: 'YouTube',
  reels: 'Reels',
  twitter: 'Twitter/X',
};

export function CreateCarouselPage() {
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspaceStore();
  const [step, setStep] = useState(1);
  const [source, setSource] = useState<ContentSource>('text');
  const [content, setContent] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<SlideContent[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      topic: '',
      toneOfVoice: '',
      audience: '',
      slideCount: 5,
      category: 'educacional',
    },
  });

  async function transcribeUrl(url: string) {
    if (!url) return;
    setIsTranscribing(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { data, error } = await client.functions.invoke('transcribe', {
        body: { url, workspace_id: activeWorkspace?.id },
      });

      if (error) throw error;
      const result = data as { transcript: string };
      setTranscription(result.transcript);
      toast.success('Transcricao extraida com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na transcricao');
    } finally {
      setIsTranscribing(false);
    }
  }

  async function generateCarousel(data: ConfigFormValues) {
    setIsGenerating(true);
    try {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) throw new Error('Nao configurado');

      const { data: result, error } = await client.functions.invoke('generate-content', {
        body: {
          workspace_id: activeWorkspace.id,
          topic: data.topic,
          content: transcription || content,
          audience: data.audience,
          tone_of_voice: data.toneOfVoice,
          slide_count: data.slideCount,
          category: data.category,
        },
      });

      if (error) throw error;

      // Validate with Zod
      const parsed = generatedContentSchema.safeParse(result);
      if (!parsed.success) {
        console.error('Zod validation failed:', parsed.error);
        throw new Error('Resposta da IA nao esta no formato esperado');
      }

      setGeneratedSlides(parsed.data.slides);
      setStep(3);
      toast.success('Carrossel gerado com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar carrossel');
    } finally {
      setIsGenerating(false);
    }
  }

  async function acceptCarousel() {
    if (!activeWorkspace) return;
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Nao autenticado');

      // Create carousel
      const { data: carousel, error: carouselError } = await client
        .from('carousels')
        .insert({
          workspace_id: activeWorkspace.id,
          created_by: user.id,
          title: generatedSlides[0]?.headline ?? 'Sem titulo',
          slide_count: generatedSlides.length,
          ai_input: {
            type: source === 'text' ? 'text' : 'url',
            content: transcription || content,
            topic: watch('topic'),
          },
        })
        .select('id')
        .single();

      if (carouselError) throw carouselError;

      // Create slides
      const slides = generatedSlides.map((slide) => ({
        carousel_id: carousel.id,
        workspace_id: activeWorkspace.id,
        position: slide.position,
        canvas_json: {
          width: 1080,
          height: 1350,
          elements: [
            {
              type: 'Rect',
              attrs: { x: 0, y: 0, width: 1080, height: 1350, fill: '#ffffff' },
            },
            {
              type: 'Text',
              attrs: {
                x: 60,
                y: slide.type === 'capa' ? 400 : 100,
                text: slide.headline,
                fontSize: slide.type === 'capa' ? 64 : 48,
                fontStyle: 'bold',
                fill: '#1f2937',
                width: 960,
                align: 'center',
              },
            },
            {
              type: 'Text',
              attrs: {
                x: 60,
                y: slide.type === 'capa' ? 540 : 250,
                text: slide.body,
                fontSize: 28,
                fill: '#4b5563',
                width: 960,
                align: 'center',
                lineHeight: 1.6,
              },
            },
          ],
        },
      }));

      const { error: slidesError } = await client
        .from('carousel_slides')
        .insert(slides);

      if (slidesError) throw slidesError;

      toast.success('Carrossel salvo');
      navigate(`/editor/${carousel.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar carrossel');
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-[#F8FAFC]">Novo Carrossel</h1>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Fonte de Conteudo</CardTitle>
              <CardDescription>Escolha de onde vem o conteudo do carrossel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(sourceLabels) as ContentSource[]).map((s) => {
                  const Icon = sourceIcons[s];
                  return (
                    <button
                      key={s}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors ${
                        source === s ? 'border-[rgba(59,130,246,0.4)] bg-[rgba(59,130,246,0.1)]' : 'hover:border-[rgba(59,130,246,0.3)] text-[#94A3B8]'
                      }`}
                      onClick={() => setSource(s)}
                    >
                      <Icon className="h-5 w-5" />
                      {sourceLabels[s]}
                    </button>
                  );
                })}
              </div>

              {source === 'text' ? (
                <div className="space-y-2">
                  <Label>Conteudo</Label>
                  <textarea
                    className="flex min-h-[120px] w-full rounded-md border border-[rgba(59,130,246,0.2)] bg-[rgba(15,18,35,0.5)] px-3 py-2 text-sm"
                    placeholder="Cole ou escreva o conteudo aqui..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Cole a URL do ${sourceLabels[source]}...`}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                    {(source === 'youtube' || source === 'reels') && (
                      <Button
                        variant="outline"
                        onClick={() => void transcribeUrl(content)}
                        disabled={isTranscribing}
                      >
                        {isTranscribing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Transcrever'
                        )}
                      </Button>
                    )}
                  </div>
                  {transcription && (
                    <div className="mt-2 max-h-32 overflow-auto rounded border bg-[rgba(59,130,246,0.04)] border-[rgba(59,130,246,0.1)] p-3 text-xs">
                      {transcription}
                    </div>
                  )}
                </div>
              )}

              <Button onClick={() => setStep(2)} className="w-full">
                Proximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Configuracao</CardTitle>
              <CardDescription>Defina os parametros de geracao.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(generateCarousel)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema / Topico</Label>
                  <Input {...register('topic')} placeholder="Ex: 5 dicas de produtividade" />
                  {errors.topic && <p className="text-sm text-red-400">{errors.topic.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tom de Voz</Label>
                    <Input {...register('toneOfVoice')} placeholder="Descontraido, profissional..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Publico-Alvo</Label>
                    <Input {...register('audience')} placeholder="Empreendedores, designers..." />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade de Slides</Label>
                    <Input type="number" min={3} max={15} {...register('slideCount', { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={watch('category')} onValueChange={(v) => setValue('category', v as ConfigFormValues['category'])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="educacional">Educacional</SelectItem>
                        <SelectItem value="vendas">Vendas</SelectItem>
                        <SelectItem value="storytelling">Storytelling</SelectItem>
                        <SelectItem value="antes_depois">Antes/Depois</SelectItem>
                        <SelectItem value="lista">Lista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isGenerating}>
                    {isGenerating ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</>
                    ) : (
                      <>Gerar Carrossel <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <CarouselPreview
            slides={generatedSlides}
            onAccept={() => void acceptCarousel()}
            onReject={() => setStep(2)}
            onRegenerate={() => {
              setGeneratedSlides([]);
              setStep(2);
            }}
            onUpdateSlide={(position, field, value) => {
              setGeneratedSlides((prev) =>
                prev.map((s) =>
                  s.position === position ? { ...s, [field]: value } : s
                )
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
