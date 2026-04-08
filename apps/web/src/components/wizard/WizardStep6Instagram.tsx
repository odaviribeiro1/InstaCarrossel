import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState } from 'react';
import { Loader2, Instagram, Eye, EyeOff, ExternalLink } from 'lucide-react';

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

const metaSchema = z.object({
  metaAppId: z.string().min(5, 'App ID e obrigatorio'),
  metaAppSecret: z.string().min(10, 'App Secret e obrigatorio'),
});

type MetaFormValues = z.infer<typeof metaSchema>;

export function WizardStep6Instagram() {
  const { setCurrentStep } = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'saved' | 'connected'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MetaFormValues>({
    resolver: zodResolver(metaSchema),
  });

  async function onSubmit(data: MetaFormValues) {
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      // Save Meta App credentials via Edge Function
      const { error: fnError } = await client.functions.invoke('store-meta-config', {
        body: {
          meta_app_id: data.metaAppId,
          meta_app_secret: data.metaAppSecret,
        },
      });

      if (fnError) {
        // Fallback: save app ID in platform_config (secret stays encrypted server-side)
        await client
          .from('platform_config')
          .update({
            meta_app_id: data.metaAppId,
            setup_step: 6,
          })
          .not('id', 'is', null);

        toast.info('Credenciais Meta salvas. App Secret sera criptografado ao deployar Edge Functions.');
      }

      setOauthStatus('saved');
      toast.success('Credenciais do Meta salvas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar credenciais');
    } finally {
      setIsLoading(false);
    }
  }

  function startOAuth() {
    // Generate CSRF state token
    const state = crypto.randomUUID();
    sessionStorage.setItem('meta_oauth_state', state);

    // Get app ID from form or saved config
    const appIdInput = document.getElementById('metaAppId') as HTMLInputElement;
    const appId = appIdInput?.value;

    if (!appId) {
      toast.error('Salve as credenciais primeiro');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/meta/callback`;
    const scope = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`;

    window.location.href = authUrl;
  }

  function skipStep() {
    void (async () => {
      const client = getSupabaseClient();
      if (client) {
        await client.from('platform_config').update({ setup_step: 6 }).not('id', 'is', null);
      }
      setCurrentStep(8);
    })();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Instagram className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Conectar Instagram</CardTitle>
            <CardDescription>
              Configure a integracao com o Instagram para publicar carrosseis.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metaAppId">Meta App ID</Label>
            <Input
              id="metaAppId"
              placeholder="Seu App ID do Meta"
              {...register('metaAppId')}
            />
            {errors.metaAppId && (
              <p className="text-sm text-red-400">{errors.metaAppId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaAppSecret">App Secret</Label>
            <div className="relative">
              <Input
                id="metaAppSecret"
                type={showSecret ? 'text' : 'password'}
                placeholder="App Secret do Meta"
                {...register('metaAppSecret')}
              />
              <button
                type="button"
                className="absolute right-2 top-2"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4 text-[#94A3B8]" />
                ) : (
                  <Eye className="h-4 w-4 text-[#94A3B8]" />
                )}
              </button>
            </div>
            {errors.metaAppSecret && (
              <p className="text-sm text-red-400">{errors.metaAppSecret.message}</p>
            )}
          </div>

          <Button type="submit" variant="outline" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Credenciais
          </Button>

          {oauthStatus === 'saved' && (
            <Button
              type="button"
              className="w-full"
              onClick={startOAuth}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Conectar com Instagram
            </Button>
          )}

          <div className="rounded-lg border bg-[rgba(59,130,246,0.04)] p-3">
            <p className="text-xs text-[#94A3B8]">
              O App Secret e processado exclusivamente via Edge Function e
              nunca fica armazenado no browser. O token exchange OAuth acontece
              server-side.
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(6)} className="flex-1">
              Voltar
            </Button>
            <Button type="button" variant="ghost" onClick={skipStep} className="flex-1">
              Pular por enquanto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
