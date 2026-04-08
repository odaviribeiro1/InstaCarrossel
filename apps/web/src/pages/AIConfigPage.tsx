import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

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
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';

const aiSchema = z.object({
  llmProvider: z.enum(['openai', 'anthropic', 'google', 'groq']),
  llmModel: z.string().min(1),
  llmApiKey: z.string().min(1, 'API Key e obrigatoria'),
  imagenApiKey: z.string().optional(),
  supadataApiKey: z.string().optional(),
});

type AIFormValues = z.infer<typeof aiSchema>;

const providerModels: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
};

export function AIConfigPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showKeys, setShowKeys] = useState({ llm: false, imagen: false, supadata: false });
  const [testResults, setTestResults] = useState({
    llm: 'idle' as 'idle' | 'testing' | 'success' | 'error',
    imagen: 'idle' as 'idle' | 'testing' | 'success' | 'error',
    supadata: 'idle' as 'idle' | 'testing' | 'success' | 'error',
  });

  const { data: existingConfig } = useQuery({
    queryKey: ['ai-config', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) return null;
      const { data } = await client
        .from('ai_configs')
        .select('llm_provider, llm_model')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(activeWorkspace),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AIFormValues>({
    resolver: zodResolver(aiSchema),
    defaultValues: {
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
      llmApiKey: '',
      imagenApiKey: '',
      supadataApiKey: '',
    },
  });

  // Update form when existing config loads
  useEffect(() => {
    if (existingConfig) {
      reset({
        llmProvider: (existingConfig.llm_provider as AIFormValues['llmProvider']) ?? 'openai',
        llmModel: existingConfig.llm_model ?? 'gpt-4o',
        llmApiKey: '',
        imagenApiKey: '',
        supadataApiKey: '',
      });
    }
  }, [existingConfig, reset]);

  const provider = watch('llmProvider');

  async function testConnection(type: 'llm' | 'imagen' | 'supadata') {
    setTestResults((s) => ({ ...s, [type]: 'testing' }));
    try {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) throw new Error('Nao configurado');

      const { error } = await client.functions.invoke('test-ai-connection', {
        body: { workspace_id: activeWorkspace.id, type },
      });

      if (error) throw error;
      setTestResults((s) => ({ ...s, [type]: 'success' }));
      toast.success(`Conexao ${type.toUpperCase()} testada com sucesso`);
    } catch {
      setTestResults((s) => ({ ...s, [type]: 'error' }));
      toast.error(`Falha ao testar conexao ${type.toUpperCase()}`);
    }
  }

  async function onSubmit(data: AIFormValues) {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { error } = await client.functions.invoke('store-ai-config', {
        body: {
          workspace_id: activeWorkspace.id,
          llm_provider: data.llmProvider,
          llm_model: data.llmModel,
          llm_api_key: data.llmApiKey,
          imagen_api_key: data.imagenApiKey || null,
          supadata_api_key: data.supadataApiKey || null,
        },
      });

      if (error) {
        // Fallback
        await client.from('ai_configs').upsert(
          {
            workspace_id: activeWorkspace.id,
            llm_provider: data.llmProvider,
            llm_model: data.llmModel,
          },
          { onConflict: 'workspace_id' }
        );
      }

      toast.success('Configuracao de IA salva');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-bold text-[#F8FAFC]">Configuracao de IA</h1>
        <Card>
          <CardHeader>
            <CardTitle>Provedor e API Keys</CardTitle>
            <CardDescription>
              Configure seu provedor de IA e insira as chaves de API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Provedor LLM</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setValue('llmProvider', v as AIFormValues['llmProvider']);
                    const models = providerModels[v];
                    if (models?.[0]) setValue('llmModel', models[0]);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={watch('llmModel')} onValueChange={(v) => setValue('llmModel', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(providerModels[provider] ?? []).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <KeyInput
                id="llmApiKey"
                label="API Key LLM"
                show={showKeys.llm}
                onToggle={() => setShowKeys((s) => ({ ...s, llm: !s.llm }))}
                testStatus={testResults.llm}
                onTest={() => void testConnection('llm')}
                register={register}
                error={errors.llmApiKey?.message}
              />

              <KeyInput
                id="imagenApiKey"
                label="API Key Gemini Imagen (opcional)"
                show={showKeys.imagen}
                onToggle={() => setShowKeys((s) => ({ ...s, imagen: !s.imagen }))}
                testStatus={testResults.imagen}
                onTest={() => void testConnection('imagen')}
                register={register}
              />

              <KeyInput
                id="supadataApiKey"
                label="API Key Supadata (opcional)"
                show={showKeys.supadata}
                onToggle={() => setShowKeys((s) => ({ ...s, supadata: !s.supadata }))}
                testStatus={testResults.supadata}
                onTest={() => void testConnection('supadata')}
                register={register}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Configuracao
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KeyInput({
  id,
  label,
  show,
  onToggle,
  testStatus,
  onTest,
  register,
  error,
}: {
  id: string;
  label: string;
  show: boolean;
  onToggle: () => void;
  testStatus: string;
  onTest: () => void;
  register: ReturnType<typeof useForm<AIFormValues>>['register'];
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input id={id} type={show ? 'text' : 'password'} {...register(id as keyof AIFormValues)} />
          <button type="button" className="absolute right-2 top-2" onClick={onToggle}>
            {show ? <EyeOff className="h-4 w-4 text-[#94A3B8]" /> : <Eye className="h-4 w-4 text-[#94A3B8]" />}
          </button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testStatus === 'testing'}>
          {testStatus === 'testing' && <Loader2 className="h-3 w-3 animate-spin" />}
          {testStatus === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
          {testStatus === 'idle' && 'Testar'}
          {testStatus === 'error' && 'Falhou'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
