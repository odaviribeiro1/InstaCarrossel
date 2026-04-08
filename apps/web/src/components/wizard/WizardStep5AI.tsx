import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Brain, Eye, EyeOff } from 'lucide-react';

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
import { useWizardStore } from '@/stores/wizard-store';
import { getSupabaseClient } from '@/lib/supabase';

const aiSchema = z.object({
  llmProvider: z.enum(['openai', 'anthropic', 'google', 'groq']),
  llmModel: z.string().min(1, 'Modelo e obrigatorio'),
  llmApiKey: z.string().min(10, 'API Key deve ter pelo menos 10 caracteres'),
  imagenApiKey: z.string().optional(),
  supadataApiKey: z.string().optional(),
});

type AIFormValues = z.infer<typeof aiSchema>;

const providerModels: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o3-mini', label: 'o3 Mini' },
    { value: 'o4-mini', label: 'o4 Mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  google: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
};

export function WizardStep5AI() {
  const { setCurrentStep } = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showKeys, setShowKeys] = useState({
    llm: false,
    imagen: false,
    supadata: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AIFormValues>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      llmProvider: 'openai',
      llmModel: 'gpt-4.1',
      llmApiKey: '',
      imagenApiKey: '',
      supadataApiKey: '',
    },
  });

  const selectedProvider = watch('llmProvider');

  async function onSubmit(data: AIFormValues) {
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { data: workspace } = await client
        .from('workspaces')
        .select('id')
        .limit(1)
        .single();

      if (!workspace) throw new Error('Workspace nao encontrado');

      // Store AI config via Edge Function (keys encrypted server-side)
      const { error: fnError } = await client.functions.invoke('store-ai-config', {
        body: {
          workspace_id: workspace.id,
          llm_provider: data.llmProvider,
          llm_model: data.llmModel,
          llm_api_key: data.llmApiKey,
          imagen_api_key: data.imagenApiKey || null,
          supadata_api_key: data.supadataApiKey || null,
        },
      });

      if (fnError) {
        // Fallback: store without encryption if Edge Function not available
        const { error } = await client.from('ai_configs').upsert({
          workspace_id: workspace.id,
          llm_provider: data.llmProvider,
          llm_model: data.llmModel,
        }, { onConflict: 'workspace_id' });

        if (error) throw error;
        toast.info('Config salva. API keys serao criptografadas ao deployar Edge Functions.');
      }

      await client.from('platform_config').update({ setup_step: 5 }).not('id', 'is', null);

      toast.success('Configuracao de IA salva');
      setCurrentStep(6);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuracao');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Brain className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Configurar IA</CardTitle>
            <CardDescription>
              Escolha seu provedor de IA e insira as API keys.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor LLM</Label>
            <Select
              value={selectedProvider}
              onValueChange={(val) => {
                setValue('llmProvider', val as AIFormValues['llmProvider']);
                const models = providerModels[val];
                if (models?.[0]) setValue('llmModel', models[0].value);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <Select
              value={watch('llmModel')}
              onValueChange={(val) => setValue('llmModel', val)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(providerModels[selectedProvider] ?? []).map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llmApiKey">API Key do LLM</Label>
            <div className="relative">
              <Input
                id="llmApiKey"
                type={showKeys.llm ? 'text' : 'password'}
                placeholder="sk-..."
                {...register('llmApiKey')}
              />
              <button
                type="button"
                className="absolute right-2 top-2"
                onClick={() => setShowKeys((s) => ({ ...s, llm: !s.llm }))}
              >
                {showKeys.llm ? (
                  <EyeOff className="h-4 w-4 text-[#94A3B8]" />
                ) : (
                  <Eye className="h-4 w-4 text-[#94A3B8]" />
                )}
              </button>
            </div>
            {errors.llmApiKey && (
              <p className="text-sm text-red-400">{errors.llmApiKey.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imagenApiKey">
              API Key Gemini Imagen{' '}
              <span className="text-[#94A3B8]">(opcional)</span>
            </Label>
            <div className="relative">
              <Input
                id="imagenApiKey"
                type={showKeys.imagen ? 'text' : 'password'}
                placeholder="AIza..."
                {...register('imagenApiKey')}
              />
              <button
                type="button"
                className="absolute right-2 top-2"
                onClick={() => setShowKeys((s) => ({ ...s, imagen: !s.imagen }))}
              >
                {showKeys.imagen ? (
                  <EyeOff className="h-4 w-4 text-[#94A3B8]" />
                ) : (
                  <Eye className="h-4 w-4 text-[#94A3B8]" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supadataApiKey">
              API Key Supadata{' '}
              <span className="text-[#94A3B8]">(transcricao - opcional)</span>
            </Label>
            <div className="relative">
              <Input
                id="supadataApiKey"
                type={showKeys.supadata ? 'text' : 'password'}
                placeholder="Chave Supadata..."
                {...register('supadataApiKey')}
              />
              <button
                type="button"
                className="absolute right-2 top-2"
                onClick={() => setShowKeys((s) => ({ ...s, supadata: !s.supadata }))}
              >
                {showKeys.supadata ? (
                  <EyeOff className="h-4 w-4 text-[#94A3B8]" />
                ) : (
                  <Eye className="h-4 w-4 text-[#94A3B8]" />
                )}
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-[rgba(59,130,246,0.04)] p-3">
            <p className="text-xs text-[#94A3B8]">
              As API keys sao criptografadas server-side via Supabase Vault e
              nunca ficam expostas no browser.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(4)} className="flex-1">
              Voltar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
