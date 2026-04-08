import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Star, Pencil } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { BrandKit } from '@content-hub/shared';

const hexRegex = /^#[0-9A-Fa-f]{6}$/;

const brandKitSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  colorPrimary: z.string().regex(hexRegex),
  colorSecondary: z.string().regex(hexRegex),
  colorAccent: z.string().regex(hexRegex),
  colorBackground: z.string().regex(hexRegex),
  colorText: z.string().regex(hexRegex),
  headingFont: z.string().min(1),
  bodyFont: z.string().min(1),
  toneOfVoice: z.string().optional(),
});

type BrandKitFormValues = z.infer<typeof brandKitSchema>;

export function BrandKitsPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<BrandKit | null>(null);

  const { data: brandKits, isLoading } = useQuery({
    queryKey: ['brand-kits', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) return [];
      const { data } = await client
        .from('brand_kits')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as BrandKit[];
    },
    enabled: Boolean(activeWorkspace),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');
      const { error } = await client.from('brand_kits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      toast.success('Brand Kit removido');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');
      const { error } = await client
        .from('brand_kits')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
      toast.success('Brand Kit definido como padrao');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openEdit(kit: BrandKit) {
    setEditingKit(kit);
    setDialogOpen(true);
  }

  function openNew() {
    setEditingKit(null);
    setDialogOpen(true);
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F8FAFC]">Brand Kits</h1>
            <p className="text-sm text-[#94A3B8]">
              Gerencie a identidade visual dos seus carrosseis.
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Kit
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4">
            {brandKits?.map((kit) => (
              <Card key={kit.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{kit.name}</CardTitle>
                      {kit.is_default && (
                        <span className="rounded bg-[rgba(59,130,246,0.1)] border border-[rgba(59,130,246,0.2)] px-2 py-0.5 text-xs font-medium text-[#60A5FA]">
                          Padrao
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {!kit.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDefaultMutation.mutate(kit.id)}
                          title="Definir como padrao"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(kit)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(kit.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {Object.entries(kit.colors).map(([key, color]) => (
                      <div key={key} className="text-center">
                        <div
                          className="h-8 w-8 rounded border"
                          style={{ backgroundColor: color }}
                        />
                        <p className="mt-1 text-[9px] text-[#94A3B8]">{key}</p>
                      </div>
                    ))}
                    <div className="ml-4 text-xs text-[#94A3B8]">
                      <p>Titulo: {kit.fonts.heading.family}</p>
                      <p>Corpo: {kit.fonts.body.family}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {brandKits?.length === 0 && (
              <p className="py-8 text-center text-[#94A3B8]">
                Nenhum Brand Kit criado ainda.
              </p>
            )}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingKit ? 'Editar Brand Kit' : 'Novo Brand Kit'}
              </DialogTitle>
            </DialogHeader>
            <BrandKitForm
              kit={editingKit}
              onSuccess={() => {
                setDialogOpen(false);
                void queryClient.invalidateQueries({ queryKey: ['brand-kits'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function BrandKitForm({
  kit,
  onSuccess,
}: {
  kit: BrandKit | null;
  onSuccess: () => void;
}) {
  const { activeWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandKitFormValues>({
    resolver: zodResolver(brandKitSchema),
    defaultValues: kit
      ? {
          name: kit.name,
          colorPrimary: kit.colors.primary,
          colorSecondary: kit.colors.secondary,
          colorAccent: kit.colors.accent,
          colorBackground: kit.colors.background,
          colorText: kit.colors.text,
          headingFont: kit.fonts.heading.family,
          bodyFont: kit.fonts.body.family,
          toneOfVoice: kit.tone_of_voice ?? '',
        }
      : {
          name: '',
          colorPrimary: '#6366f1',
          colorSecondary: '#8b5cf6',
          colorAccent: '#f59e0b',
          colorBackground: '#ffffff',
          colorText: '#1f2937',
          headingFont: 'Inter',
          bodyFont: 'Inter',
          toneOfVoice: '',
        },
  });

  async function onSubmit(data: BrandKitFormValues) {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const payload = {
        workspace_id: activeWorkspace.id,
        name: data.name,
        colors: {
          primary: data.colorPrimary,
          secondary: data.colorSecondary,
          accent: data.colorAccent,
          background: data.colorBackground,
          text: data.colorText,
        },
        fonts: {
          heading: { family: data.headingFont, url: '' },
          body: { family: data.bodyFont, url: '' },
        },
        tone_of_voice: data.toneOfVoice || null,
      };

      if (kit) {
        const { error } = await client
          .from('brand_kits')
          .update(payload)
          .eq('id', kit.id);
        if (error) throw error;
        toast.success('Brand Kit atualizado');
      } else {
        const { error } = await client.from('brand_kits').insert(payload);
        if (error) throw error;
        toast.success('Brand Kit criado');
      }

      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input {...register('name')} />
        {errors.name && <p className="text-sm text-red-400">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Cores</Label>
        <div className="grid grid-cols-5 gap-2">
          {(['colorPrimary', 'colorSecondary', 'colorAccent', 'colorBackground', 'colorText'] as const).map((field) => (
            <div key={field}>
              <Input type="color" className="h-8 w-full cursor-pointer p-0.5" {...register(field)} />
              <p className="mt-0.5 text-center text-[9px] text-[#94A3B8]">
                {field.replace('color', '')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fonte Titulo</Label>
          <Input {...register('headingFont')} />
        </div>
        <div className="space-y-2">
          <Label>Fonte Corpo</Label>
          <Input {...register('bodyFont')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tom de Voz</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-[rgba(59,130,246,0.2)] bg-[rgba(15,18,35,0.5)] text-[#F8FAFC] px-3 py-2 text-sm"
          placeholder="Ex: Descontraido, com emojis..."
          {...register('toneOfVoice')}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {kit ? 'Atualizar' : 'Criar'}
      </Button>
    </form>
  );
}
