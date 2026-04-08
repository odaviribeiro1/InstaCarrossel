import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, LayoutTemplate } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { getSupabaseClient } from '@/lib/supabase';
import type { Template, TemplateCategory } from '@content-hub/shared';

const categories: { value: TemplateCategory; label: string }[] = [
  { value: 'educacional', label: 'Educacional' },
  { value: 'vendas', label: 'Vendas' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'antes_depois', label: 'Antes/Depois' },
  { value: 'lista', label: 'Lista' },
  { value: 'cta', label: 'CTA' },
];

const templateSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  category: z.enum(['educacional', 'vendas', 'storytelling', 'antes_depois', 'lista', 'cta']),
  slideCountDefault: z.number().min(1).max(20),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

export function TemplatesPage() {
  const { activeWorkspace } = useWorkspaceStore();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client) return [];
      const { data } = await client
        .from('templates')
        .select('*')
        .order('is_system', { ascending: false })
        .order('created_at', { ascending: false });
      return (data ?? []) as Template[];
    },
    enabled: Boolean(activeWorkspace),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');
      const { error } = await client.from('templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template removido');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered =
    activeCategory === 'all'
      ? templates
      : templates?.filter((t) => t.category === activeCategory);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F8FAFC]">Templates</h1>
            <p className="text-sm text-[#94A3B8]">
              Modelos de carrossel para acelerar a criacao.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Template
          </Button>
        </div>

        {/* Category filter */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {filtered?.map((template) => (
              <Card key={template.id} className="group relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {categories.find((c) => c.value === template.category)?.label}
                        {template.is_system && ' (sistema)'}
                      </CardDescription>
                    </div>
                    {!template.is_system && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={() => deleteMutation.mutate(template.id)}
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex aspect-[4/5] items-center justify-center rounded-md bg-[rgba(59,130,246,0.04)] border border-[rgba(59,130,246,0.08)]">
                    <LayoutTemplate className="h-8 w-8 text-[#94A3B8]" />
                  </div>
                  <p className="mt-2 text-xs text-[#94A3B8]">
                    {template.slide_count_default} slides
                  </p>
                </CardContent>
              </Card>
            ))}
            {filtered?.length === 0 && (
              <div className="col-span-full py-8 text-center text-[#94A3B8]">
                Nenhum template encontrado nesta categoria.
              </div>
            )}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Template</DialogTitle>
            </DialogHeader>
            <TemplateForm
              onSuccess={() => {
                setDialogOpen(false);
                void queryClient.invalidateQueries({ queryKey: ['templates'] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function TemplateForm({ onSuccess }: { onSuccess: () => void }) {
  const { activeWorkspace } = useWorkspaceStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      category: 'educacional',
      slideCountDefault: 5,
    },
  });

  async function onSubmit(data: TemplateFormValues) {
    if (!activeWorkspace) return;
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      const { error } = await client.from('templates').insert({
        workspace_id: activeWorkspace.id,
        name: data.name,
        category: data.category,
        slide_count_default: data.slideCountDefault,
        is_system: false,
      });

      if (error) throw error;
      toast.success('Template criado');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar template');
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
        <Label>Categoria</Label>
        <Select value={watch('category')} onValueChange={(v) => setValue('category', v as TemplateCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Quantidade de Slides</Label>
        <Input
          type="number"
          min={1}
          max={20}
          {...register('slideCountDefault', { valueAsNumber: true })}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Criar Template
      </Button>
    </form>
  );
}
