import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { Loader2, Brush, Upload } from 'lucide-react';

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

const hexRegex = /^#[0-9A-Fa-f]{6}$/;

const brandKitSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  colorPrimary: z.string().regex(hexRegex, 'Formato hex invalido'),
  colorSecondary: z.string().regex(hexRegex, 'Formato hex invalido'),
  colorAccent: z.string().regex(hexRegex, 'Formato hex invalido'),
  colorBackground: z.string().regex(hexRegex, 'Formato hex invalido'),
  colorText: z.string().regex(hexRegex, 'Formato hex invalido'),
  headingFont: z.string().min(1, 'Fonte do titulo e obrigatoria'),
  bodyFont: z.string().min(1, 'Fonte do corpo e obrigatoria'),
  toneOfVoice: z.string().optional(),
});

type BrandKitFormValues = z.infer<typeof brandKitSchema>;

export function WizardStep4BrandKit() {
  const { setCurrentStep } = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandKitFormValues>({
    resolver: zodResolver(brandKitSchema),
    defaultValues: {
      name: 'Padrao',
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

  function handleFile(e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'avatar') {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'logo' && logoPreview) URL.revokeObjectURL(logoPreview);
    if (type === 'avatar' && avatarPreview) URL.revokeObjectURL(avatarPreview);
    const url = URL.createObjectURL(file);
    if (type === 'logo') {
      setLogoPreview(url);
      setLogoFile(file);
    } else {
      setAvatarPreview(url);
      setAvatarFile(file);
    }
  }

  async function onSubmit(data: BrandKitFormValues) {
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

      let logoUrl: string | null = null;
      let avatarUrl: string | null = null;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `${workspace.id}/brand-logo.${ext}`;
        await client.storage.from('logos').upload(path, logoFile, { upsert: true });
        const { data: urlData } = client.storage.from('logos').getPublicUrl(path);
        logoUrl = urlData.publicUrl;
      }

      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `${workspace.id}/avatar.${ext}`;
        await client.storage.from('avatars').upload(path, avatarFile, { upsert: true });
        const { data: urlData } = client.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const { error } = await client.from('brand_kits').insert({
        workspace_id: workspace.id,
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
        logo_url: logoUrl,
        avatar_url: avatarUrl,
        tone_of_voice: data.toneOfVoice || null,
        is_default: true,
      });

      if (error) throw error;

      await client.from('platform_config').update({ setup_step: 4 }).not('id', 'is', null);

      toast.success('Brand Kit criado');
      setCurrentStep(6);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar Brand Kit');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(59,130,246,0.1)]">
            <Brush className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Brand Kit</CardTitle>
            <CardDescription>
              Defina a identidade visual dos seus carrosseis.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Kit</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-400">{errors.name.message}</p>}
          </div>

          {/* Logo and Avatar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Logo do Carrossel</Label>
              <div
                className="flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-[rgba(59,130,246,0.4)]"
                onClick={() => logoRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full object-contain" />
                ) : (
                  <Upload className="h-5 w-5 text-[#94A3B8]" />
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'logo')} />
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div
                className="flex h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-[rgba(59,130,246,0.4)]"
                onClick={() => avatarRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full rounded-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-[#94A3B8]" />
                )}
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, 'avatar')} />
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <Label>Paleta de Cores</Label>
            <div className="grid grid-cols-5 gap-2">
              {(['colorPrimary', 'colorSecondary', 'colorAccent', 'colorBackground', 'colorText'] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Input type="color" className="h-8 w-full cursor-pointer p-0.5" {...register(field)} />
                  <p className="text-[10px] text-center text-[#94A3B8]">
                    {field.replace('color', '')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="headingFont">Fonte Titulo</Label>
              <Input id="headingFont" placeholder="Inter" {...register('headingFont')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyFont">Fonte Corpo</Label>
              <Input id="bodyFont" placeholder="Inter" {...register('bodyFont')} />
            </div>
          </div>

          {/* Tone of voice */}
          <div className="space-y-2">
            <Label htmlFor="toneOfVoice">Tom de Voz (opcional)</Label>
            <textarea
              id="toneOfVoice"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-[#0A0A0F] px-3 py-2 text-sm placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Ex: Fale de forma descontraida, use emojis, seja direto..."
              {...register('toneOfVoice')}
            />
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
