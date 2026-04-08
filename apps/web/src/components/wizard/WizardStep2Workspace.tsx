import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { Loader2, Building2 } from 'lucide-react';

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
import { useAuth } from '@/hooks/use-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { slugify } from '@content-hub/shared';

const workspaceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  slug: z
    .string()
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Slug pode conter apenas letras minusculas, numeros e hifens'),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

export function WizardStep2Workspace() {
  const { setCurrentStep } = useWizardStore();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '', slug: '' },
  });

  const nameValue = watch('name');
  const slugValue = watch('slug');

  // Auto-generate slug from name
  useEffect(() => {
    if (nameValue) {
      setValue('slug', slugify(nameValue));
    }
  }, [nameValue, setValue]);

  // Check slug availability (debounced)
  useEffect(() => {
    if (!slugValue || slugValue.length < 2) {
      setSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      const client = getSupabaseClient();
      if (!client) return;

      // Use RPC to check slug since RLS on workspaces blocks SELECT for users without a workspace
      const { data, error } = await client
        .from('workspaces')
        .select('id')
        .eq('slug', slugValue)
        .maybeSingle();

      // If RLS blocks the query (403), assume slug is available (user has no workspaces yet)
      if (error && error.code === '42501') {
        setSlugAvailable(true);
      } else {
        setSlugAvailable(!data);
      }
      setCheckingSlug(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [slugValue]);

  async function onSubmit(data: WorkspaceFormValues) {
    if (!user) {
      toast.error('Usuario nao autenticado');
      return;
    }

    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      let workspaceId: string | null = null;

      // Try RPC first (atomic workspace + owner creation)
      const { data: rpcResult, error: rpcError } = await client
        .rpc('create_workspace_with_owner', {
          p_name: data.name,
          p_slug: data.slug,
        });

      if (!rpcError && rpcResult) {
        workspaceId = rpcResult;
      } else {
        // Fallback: direct INSERTs (RPC may not exist if migration 012 wasn't applied)
        console.warn('RPC create_workspace_with_owner indisponivel, usando fallback:', rpcError?.message);

        // Generate workspace ID client-side to avoid needing SELECT after INSERT
        // (RLS SELECT policy blocks reads for users with no workspace membership)
        const newId = crypto.randomUUID();

        const { error: wsError } = await client
          .from('workspaces')
          .insert({ id: newId, name: data.name, slug: data.slug });

        if (wsError) throw wsError;

        const { error: memberError } = await client
          .from('workspace_members')
          .insert({
            workspace_id: newId,
            user_id: user.id,
            role: 'owner',
          });

        if (memberError) {
          // Clean up orphaned workspace
          await client.from('workspaces').delete().eq('id', newId);
          throw memberError;
        }

        workspaceId = newId;
      }

      if (!workspaceId) throw new Error('Erro ao criar workspace');

      // Update setup step
      await client
        .from('platform_config')
        .update({ setup_step: 2 })
        .not('id', 'is', null);

      toast.success('Workspace criado com sucesso');
      setCurrentStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar workspace';
      toast.error(msg);
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
            <CardTitle>Criar Workspace</CardTitle>
            <CardDescription>
              Defina o nome e identificador do seu workspace.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Workspace</Label>
            <Input
              id="name"
              placeholder="Minha Empresa"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-sm text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (identificador unico)</Label>
            <Input
              id="slug"
              placeholder="minha-empresa"
              {...register('slug')}
            />
            {errors.slug && (
              <p className="text-sm text-red-400">{errors.slug.message}</p>
            )}
            {checkingSlug && (
              <p className="text-xs text-[#94A3B8]">Verificando disponibilidade...</p>
            )}
            {slugAvailable === true && !checkingSlug && slugValue.length >= 2 && (
              <p className="text-xs text-green-600">Slug disponivel</p>
            )}
            {slugAvailable === false && !checkingSlug && (
              <p className="text-xs text-red-400">Slug ja em uso</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || slugAvailable === false}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Workspace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
