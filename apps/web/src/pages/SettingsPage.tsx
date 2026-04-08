import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  UserPlus,
  Trash2,
  Upload,
  Palette,
  Building2,
  Instagram,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { useAuthStore } from '@/stores/auth-store';
import { getSupabaseClient } from '@/lib/supabase';

export function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold text-[#F8FAFC]">Configuracoes</h1>
        <RoleGuard
          minRole="admin"
          fallback={
            <p className="text-[#94A3B8]">
              Voce nao tem permissao para acessar configuracoes.
            </p>
          }
        >
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="whitelabel">Aparencia</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="instagram">Instagram</TabsTrigger>
              <TabsTrigger value="members">Membros</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="mt-4">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="whitelabel" className="mt-4">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <AITab />
            </TabsContent>
            <TabsContent value="instagram" className="mt-4">
              <InstagramTab />
            </TabsContent>
            <TabsContent value="members" className="mt-4">
              <MembersTab />
            </TabsContent>
          </Tabs>
        </RoleGuard>
      </div>
    </div>
  );
}

// ============================================================
// GERAL
// ============================================================

const generalSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Apenas letras minusculas, numeros e hifens'),
});

type GeneralFormValues = z.infer<typeof generalSchema>;

function GeneralTab() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: activeWorkspace?.name ?? '',
      slug: activeWorkspace?.slug ?? '',
    },
  });

  useEffect(() => {
    if (activeWorkspace) {
      reset({ name: activeWorkspace.name, slug: activeWorkspace.slug });
    }
  }, [activeWorkspace, reset]);

  async function onSubmit(data: GeneralFormValues) {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { error } = await client
        .from('workspaces')
        .update({ name: data.name, slug: data.slug })
        .eq('id', activeWorkspace.id);

      if (error) throw error;

      setActiveWorkspace({ ...activeWorkspace, name: data.name, slug: data.slug });
      toast.success('Workspace atualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Building2 className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle className="text-lg">Informacoes do Workspace</CardTitle>
            <CardDescription>Nome e identificador do workspace.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Nome do Workspace</Label>
            <Input id="ws-name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-400">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">Slug</Label>
            <Input id="ws-slug" {...register('slug')} />
            {errors.slug && <p className="text-sm text-red-400">{errors.slug.message}</p>}
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// APARENCIA
// ============================================================

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const appearanceSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Cor hex invalida'),
  secondaryColor: z.string().regex(hexColorRegex, 'Cor hex invalida'),
  customDomain: z.string().optional(),
});

type AppearanceFormValues = z.infer<typeof appearanceSchema>;

function AppearanceTab() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(activeWorkspace?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      primaryColor: activeWorkspace?.brand_primary_color ?? '#3B82F6',
      secondaryColor: activeWorkspace?.brand_secondary_color ?? '#60A5FA',
      customDomain: activeWorkspace?.custom_domain ?? '',
    },
  });

  useEffect(() => {
    if (activeWorkspace) {
      reset({
        primaryColor: activeWorkspace.brand_primary_color ?? '#3B82F6',
        secondaryColor: activeWorkspace.brand_secondary_color ?? '#60A5FA',
        customDomain: activeWorkspace.custom_domain ?? '',
      });
      setLogoPreview(activeWorkspace.logo_url ?? null);
    }
  }, [activeWorkspace, reset]);

  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');

  async function onSubmit(data: AppearanceFormValues) {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      let logoUrl = activeWorkspace.logo_url;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `${activeWorkspace.id}/logo.${ext}`;
        const { error: uploadError } = await client.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = client.storage.from('logos').getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        } else {
          console.warn('Upload de logo falhou:', uploadError.message);
        }
      }

      const updateData: Record<string, unknown> = {
        brand_primary_color: data.primaryColor,
        brand_secondary_color: data.secondaryColor,
      };
      if (logoUrl) updateData.logo_url = logoUrl;
      if (data.customDomain) updateData.custom_domain = data.customDomain;

      const { error } = await client
        .from('workspaces')
        .update(updateData)
        .eq('id', activeWorkspace.id);

      if (error) throw error;

      setActiveWorkspace({
        ...activeWorkspace,
        brand_primary_color: data.primaryColor,
        brand_secondary_color: data.secondaryColor,
        logo_url: logoUrl ?? activeWorkspace.logo_url,
        custom_domain: data.customDomain ?? activeWorkspace.custom_domain,
      });

      document.documentElement.style.setProperty('--brand-primary', data.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', data.secondaryColor);

      toast.success('Aparencia atualizada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Palette className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle className="text-lg">Aparencia da Plataforma</CardTitle>
            <CardDescription>Logo, cores e dominio customizado.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo da Plataforma</Label>
            <div className="flex items-center gap-4">
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[rgba(59,130,246,0.2)] hover:border-[rgba(59,130,246,0.4)] transition-colors">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full rounded-xl object-contain" />
                ) : (
                  <Upload className="h-5 w-5 text-[#94A3B8]" />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              <p className="text-xs text-[#94A3B8]">PNG, JPG ou SVG. Recomendado: 200x50px.</p>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Primaria</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  className="h-9 w-12 cursor-pointer rounded border border-[rgba(59,130,246,0.2)] bg-transparent"
                  onChange={(e) => {
                    register('primaryColor').onChange({ target: { name: 'primaryColor', value: e.target.value } });
                  }}
                />
                <Input {...register('primaryColor')} className="flex-1" />
              </div>
              {errors.primaryColor && <p className="text-sm text-red-400">{errors.primaryColor.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Cor Secundaria</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  className="h-9 w-12 cursor-pointer rounded border border-[rgba(59,130,246,0.2)] bg-transparent"
                  onChange={(e) => {
                    register('secondaryColor').onChange({ target: { name: 'secondaryColor', value: e.target.value } });
                  }}
                />
                <Input {...register('secondaryColor')} className="flex-1" />
              </div>
              {errors.secondaryColor && <p className="text-sm text-red-400">{errors.secondaryColor.message}</p>}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[rgba(59,130,246,0.12)] p-4">
            <p className="mb-2 text-xs font-medium text-[#94A3B8]">Preview</p>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: primaryColor }} />
              <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: secondaryColor }} />
              <div className="flex flex-1 items-center">
                <div className="h-2 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
              </div>
            </div>
          </div>

          {/* Domain */}
          <div className="space-y-2">
            <Label>Dominio Customizado <span className="text-[#94A3B8]">(opcional)</span></Label>
            <Input placeholder="app.suaempresa.com" {...register('customDomain')} />
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Aparencia
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// IA
// ============================================================

const aiSchema = z.object({
  llmProvider: z.enum(['openai', 'anthropic', 'google', 'groq']),
  llmModel: z.string().min(1),
  llmApiKey: z.string().optional(),
  imagenApiKey: z.string().optional(),
  supadataApiKey: z.string().optional(),
});

type AIFormValues = z.infer<typeof aiSchema>;

const providerModels: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o4-mini', label: 'o4 Mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
  ],
  google: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  groq: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
};

function AITab() {
  const { activeWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showKeys, setShowKeys] = useState({ llm: false, imagen: false, supadata: false });

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
      llmModel: 'gpt-4.1',
      llmApiKey: '',
      imagenApiKey: '',
      supadataApiKey: '',
    },
  });

  useEffect(() => {
    if (existingConfig) {
      reset({
        llmProvider: (existingConfig.llm_provider as AIFormValues['llmProvider']) ?? 'openai',
        llmModel: existingConfig.llm_model ?? 'gpt-4.1',
        llmApiKey: '',
        imagenApiKey: '',
        supadataApiKey: '',
      });
    }
  }, [existingConfig, reset]);

  const provider = watch('llmProvider');

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
          llm_api_key: data.llmApiKey || null,
          imagen_api_key: data.imagenApiKey || null,
          supadata_api_key: data.supadataApiKey || null,
        },
      });

      if (error) {
        await client.from('ai_configs').upsert(
          { workspace_id: activeWorkspace.id, llm_provider: data.llmProvider, llm_model: data.llmModel },
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

  function ToggleEye({ field }: { field: 'llm' | 'imagen' | 'supadata' }) {
    const show = showKeys[field];
    return (
      <button type="button" className="absolute right-2 top-2" onClick={() => setShowKeys((s) => ({ ...s, [field]: !s[field] }))}>
        {show ? <EyeOff className="h-4 w-4 text-[#94A3B8]" /> : <Eye className="h-4 w-4 text-[#94A3B8]" />}
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Provedor e API Keys</CardTitle>
        <CardDescription>Configure seu provedor de IA e insira as chaves de API.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provedor LLM</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setValue('llmProvider', v as AIFormValues['llmProvider']);
                  const models = providerModels[v];
                  if (models?.[0]) setValue('llmModel', models[0].value);
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
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key LLM</Label>
            <div className="relative">
              <Input type={showKeys.llm ? 'text' : 'password'} placeholder="sk-..." {...register('llmApiKey')} />
              <ToggleEye field="llm" />
            </div>
            {errors.llmApiKey && <p className="text-sm text-red-400">{errors.llmApiKey.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Key Gemini Imagen <span className="text-[#94A3B8]">(opcional)</span></Label>
              <div className="relative">
                <Input type={showKeys.imagen ? 'text' : 'password'} placeholder="AIza..." {...register('imagenApiKey')} />
                <ToggleEye field="imagen" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Key Supadata <span className="text-[#94A3B8]">(opcional)</span></Label>
              <div className="relative">
                <Input type={showKeys.supadata ? 'text' : 'password'} placeholder="Chave..." {...register('supadataApiKey')} />
                <ToggleEye field="supadata" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] p-3">
            <p className="text-xs text-[#94A3B8]">
              As API keys sao criptografadas server-side via Supabase Vault e nunca ficam expostas no browser.
            </p>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configuracao
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// INSTAGRAM
// ============================================================

const metaConfigSchema = z.object({
  metaAppId: z.string().min(1, 'Meta App ID e obrigatorio'),
  metaAppSecret: z.string().min(1, 'Meta App Secret e obrigatorio'),
});

type MetaConfigFormValues = z.infer<typeof metaConfigSchema>;

function InstagramTab() {
  const { activeWorkspace } = useWorkspaceStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [savedMetaConfig, setSavedMetaConfig] = useState<{ meta_app_id: string | null; has_app_secret: boolean } | null>(null);

  const { data: metaConfig, refetch: refetchMetaConfig } = useQuery({
    queryKey: ['meta-config', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client.rpc('get_meta_config');
        if (error) return null;
        return data as { meta_app_id: string | null; has_app_secret: boolean } | null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(activeWorkspace),
  });

  const {
    register: registerMeta,
    handleSubmit: handleSubmitMeta,
    reset: resetMeta,
    formState: { errors: metaErrors },
  } = useForm<MetaConfigFormValues>({
    resolver: zodResolver(metaConfigSchema),
    defaultValues: {
      metaAppId: '',
      metaAppSecret: '',
    },
  });

  useEffect(() => {
    if (metaConfig) {
      resetMeta({
        metaAppId: metaConfig.meta_app_id ?? '',
        metaAppSecret: '',
      });
    }
  }, [metaConfig, resetMeta]);

  async function onSaveMetaConfig(data: MetaConfigFormValues) {
    setIsSavingMeta(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { error } = await client.functions.invoke('store-meta-config', {
        body: {
          meta_app_id: data.metaAppId,
          meta_app_secret: data.metaAppSecret,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao salvar configuracao Meta');

      toast.success('Configuracao Meta salva');
      setSavedMetaConfig({ meta_app_id: data.metaAppId, has_app_secret: true });
      void refetchMetaConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsSavingMeta(false);
    }
  }

  // Effect 1: Capture OAuth params immediately on mount (no async dependencies)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');

    if (!code) return;

    // Clean URL immediately so params don't persist
    window.history.replaceState({}, '', window.location.pathname);

    if (errorParam) {
      toast.error(`Erro no OAuth: ${params.get('error_description') || errorParam}`);
      return;
    }

    // Validate CSRF state
    const savedState = sessionStorage.getItem('meta_oauth_state');
    if (state !== savedState) {
      toast.error('Erro de seguranca: state invalido. Tente conectar novamente.');
      return;
    }
    sessionStorage.removeItem('meta_oauth_state');

    // Persist code for exchange when workspace is ready
    sessionStorage.setItem('meta_oauth_code', code);
  }, []);

  // Effect 2: Exchange code when workspace is ready
  useEffect(() => {
    const code = sessionStorage.getItem('meta_oauth_code');
    if (!code || !activeWorkspace) return;

    sessionStorage.removeItem('meta_oauth_code');

    async function exchangeCode() {
      setIsConnecting(true);
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Supabase nao configurado');

        const redirectUri = `${window.location.origin}/settings`;

        const { data, error: fnError } = await client.functions.invoke('meta-oauth', {
          body: {
            code,
            redirect_uri: redirectUri,
            workspace_id: activeWorkspace!.id,
          },
        });

        if (fnError) throw new Error(fnError.message || 'Erro no token exchange');

        const result = data as { success?: boolean; error?: string; pages?: Array<{ page_name: string; ig_user_id: string | null }> };

        if (result?.error) throw new Error(result.error);

        if (result?.pages && result.pages.length > 0) {
          const connected = result.pages.find((p) => p.ig_user_id);
          if (connected) {
            toast.success(`Instagram conectado: ${connected.page_name}`);
          } else {
            toast.warning('Conta conectada, mas nenhuma conta Instagram Business foi encontrada nas paginas.');
          }
        } else {
          toast.success('Instagram conectado');
        }

        void refetchConnection();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao conectar Instagram');
      } finally {
        setIsConnecting(false);
      }
    }

    void exchangeCode();
  }, [activeWorkspace]);

  const { data: connection, isLoading, refetch: refetchConnection } = useQuery({
    queryKey: ['meta-connection', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) return null;
      const { data } = await client
        .from('meta_connections')
        .select('id, ig_user_id, token_expires_at')
        .eq('workspace_id', activeWorkspace.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(activeWorkspace),
  });

  const isExpired = connection?.token_expires_at
    ? new Date(connection.token_expires_at) < new Date()
    : false;

  async function handleDisconnect() {
    const client = getSupabaseClient();
    if (!client || !connection) return;
    const { error } = await client.from('meta_connections').delete().eq('id', connection.id);
    if (error) {
      toast.error('Erro ao desconectar');
    } else {
      toast.success('Instagram desconectado');
    }
  }

  const effectiveMetaConfig = savedMetaConfig ?? metaConfig;
  const hasMetaCredentials = Boolean(effectiveMetaConfig?.meta_app_id);

  function handleConnectInstagram() {
    const appId = effectiveMetaConfig?.meta_app_id;
    if (!appId) {
      toast.error('Configure o Meta App ID primeiro');
      return;
    }

    setIsConnecting(true);

    // Generate CSRF state token
    const state = crypto.randomUUID();
    sessionStorage.setItem('meta_oauth_state', state);

    const redirectUri = `${window.location.origin}/settings`;
    const scope = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
  }

  return (
    <div className="space-y-6">
      {/* Meta App Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
              <Instagram className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <div>
              <CardTitle className="text-lg">Credenciais Meta</CardTitle>
              <CardDescription>Configure o Meta App ID e App Secret para conectar ao Instagram.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitMeta(onSaveMetaConfig)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta-app-id">Meta App ID</Label>
              <Input id="meta-app-id" placeholder="123456789012345" {...registerMeta('metaAppId')} />
              {metaErrors.metaAppId && <p className="text-sm text-red-400">{metaErrors.metaAppId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-app-secret">Meta App Secret</Label>
              <div className="relative">
                <Input
                  id="meta-app-secret"
                  type={showSecret ? 'text' : 'password'}
                  placeholder={metaConfig?.has_app_secret ? '••••••••••••••••' : 'Insira o App Secret'}
                  {...registerMeta('metaAppSecret')}
                />
                <button
                  type="button"
                  className="absolute right-2 top-2"
                  onClick={() => setShowSecret((s) => !s)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4 text-[#94A3B8]" />
                  ) : (
                    <Eye className="h-4 w-4 text-[#94A3B8]" />
                  )}
                </button>
              </div>
              {metaErrors.metaAppSecret && <p className="text-sm text-red-400">{metaErrors.metaAppSecret.message}</p>}
            </div>

            {effectiveMetaConfig?.meta_app_id && (
              <div className="rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] p-3">
                <p className="text-xs text-[#94A3B8]">
                  <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-emerald-400" />
                  App ID configurado: {effectiveMetaConfig.meta_app_id}
                  {effectiveMetaConfig.has_app_secret && ' | App Secret configurado'}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] p-3">
              <p className="text-xs text-[#94A3B8]">
                O App Secret e criptografado server-side via Supabase Vault e nunca fica exposto no browser.
              </p>
            </div>

            <Button type="submit" disabled={isSavingMeta}>
              {isSavingMeta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Credenciais
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
              <Instagram className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <div>
              <CardTitle className="text-lg">Conexao com Instagram</CardTitle>
              <CardDescription>Conecte sua conta para publicar carrosseis diretamente.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
            </div>
          ) : connection ? (
            <>
              <div className="flex items-center justify-between rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#F8FAFC]">
                    <CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-400" />
                    Conectado
                  </p>
                  <p className="mt-1 text-xs text-[#94A3B8]">
                    IG User ID: {connection.ig_user_id ?? 'N/A'}
                  </p>
                  {connection.token_expires_at && (
                    <p className={`mt-0.5 text-xs ${isExpired ? 'text-red-400' : 'text-[#94A3B8]'}`}>
                      Token {isExpired ? 'expirado em' : 'expira em'}{' '}
                      {new Date(connection.token_expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
              {isExpired && (
                <p className="text-xs text-red-400">
                  O token expirou. Reconecte sua conta para continuar publicando.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] p-6 text-center">
              <Instagram className="mx-auto h-10 w-10 text-[#94A3B8]" />
              <p className="mt-3 text-sm text-[#94A3B8]">
                Nenhuma conta do Instagram conectada.
              </p>
              {!hasMetaCredentials && (
                <p className="mt-1 text-xs text-[#94A3B8]/60">
                  Configure o Meta App ID e App Secret acima antes de conectar.
                </p>
              )}
              <Button className="mt-4" disabled={isConnecting || !hasMetaCredentials} onClick={handleConnectInstagram}>
                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Conectar Instagram
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// MEMBROS
// ============================================================

const inviteSchema = z.object({
  email: z.string().email('Email invalido'),
  role: z.enum(['admin', 'editor', 'viewer']),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface MemberWithEmail {
  id: string;
  user_id: string;
  role: string;
}

function MembersTab() {
  const { activeWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'editor' },
  });

  useEffect(() => {
    if (activeWorkspace) void loadMembers();
  }, [activeWorkspace]);

  async function loadMembers() {
    const client = getSupabaseClient();
    if (!client || !activeWorkspace) return;
    setLoading(true);
    const { data } = await client
      .from('workspace_members')
      .select('id, user_id, role')
      .eq('workspace_id', activeWorkspace.id);
    if (data) setMembers(data);
    setLoading(false);
  }

  async function onInvite(data: InviteFormValues) {
    setIsInviting(true);
    try {
      toast.info(`Convite para ${data.email} como ${data.role}. O usuario precisa estar registrado.`);
      setInviteOpen(false);
      reset();
    } finally {
      setIsInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('workspace_members').delete().eq('id', memberId);
    if (error) { toast.error('Erro ao remover membro'); return; }
    toast.success('Membro removido');
    void loadMembers();
  }

  async function updateRole(memberId: string, newRole: string) {
    const client = getSupabaseClient();
    if (!client) return;
    const { error } = await client.from('workspace_members').update({ role: newRole }).eq('id', memberId);
    if (error) { toast.error('Erro ao atualizar papel'); return; }
    toast.success('Papel atualizado');
    void loadMembers();
  }

  const roleLabels: Record<string, string> = {
    owner: 'Proprietario',
    admin: 'Administrador',
    editor: 'Editor',
    viewer: 'Visualizador',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Membros do Workspace</CardTitle>
            <CardDescription>{members.length} membro{members.length !== 1 ? 's' : ''}</CardDescription>
          </div>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar Membro</DialogTitle>
                <DialogDescription>Adicione um novo membro ao workspace.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="membro@email.com" {...register('email')} />
                  {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select defaultValue="editor" onValueChange={(val) => setValue('role', val as 'admin' | 'editor' | 'viewer')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isInviting}>
                  {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Convite
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-[rgba(59,130,246,0.12)] bg-[rgba(59,130,246,0.04)] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#F8FAFC]">
                    {member.user_id === user?.id ? 'Voce' : member.user_id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-[#94A3B8]">{roleLabels[member.role] ?? member.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role !== 'owner' && member.user_id !== user?.id && (
                    <>
                      <Select value={member.role} onValueChange={(val) => void updateRole(member.id, val)}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Visualizador</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => void removeMember(member.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
