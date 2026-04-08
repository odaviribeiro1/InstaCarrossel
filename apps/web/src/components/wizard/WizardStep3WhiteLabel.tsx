import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';
import { Loader2, Palette, Upload } from 'lucide-react';

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

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const whiteLabelSchema = z.object({
  primaryColor: z
    .string()
    .regex(hexColorRegex, 'Cor deve estar no formato hex (#RRGGBB)'),
  secondaryColor: z
    .string()
    .regex(hexColorRegex, 'Cor deve estar no formato hex (#RRGGBB)'),
  customDomain: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(val),
      'Dominio invalido'
    ),
});

type WhiteLabelFormValues = z.infer<typeof whiteLabelSchema>;

export function WizardStep3WhiteLabel() {
  const { setCurrentStep } = useWizardStore();
  const [isLoading, setIsLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      if (faviconPreview) URL.revokeObjectURL(faviconPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WhiteLabelFormValues>({
    resolver: zodResolver(whiteLabelSchema),
    defaultValues: {
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
      customDomain: '',
    },
  });

  const primaryColor = watch('primaryColor');
  const secondaryColor = watch('secondaryColor');

  function handleFileSelect(
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'favicon'
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    if (type === 'logo') {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(url);
      setLogoFile(file);
    } else {
      if (faviconPreview) URL.revokeObjectURL(faviconPreview);
      setFaviconPreview(url);
      setFaviconFile(file);
    }
  }

  async function onSubmit(data: WhiteLabelFormValues) {
    setIsLoading(true);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase nao configurado');

      // Get workspace
      const { data: workspaces } = await client
        .from('workspaces')
        .select('id')
        .limit(1)
        .single();

      if (!workspaces) throw new Error('Workspace nao encontrado');

      let logoUrl: string | null = null;
      let faviconUrl: string | null = null;

      // Upload logo (non-blocking — bucket may not exist if migrations weren't fully applied)
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `${workspaces.id}/logo.${ext}`;
        const { error: uploadError } = await client.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true });

        if (uploadError) {
          console.warn('Upload de logo falhou (bucket pode nao existir):', uploadError.message);
        } else {
          const { data: urlData } = client.storage
            .from('logos')
            .getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // Upload favicon (non-blocking)
      if (faviconFile) {
        const ext = faviconFile.name.split('.').pop();
        const path = `${workspaces.id}/favicon.${ext}`;
        const { error: uploadError } = await client.storage
          .from('logos')
          .upload(path, faviconFile, { upsert: true });

        if (uploadError) {
          console.warn('Upload de favicon falhou:', uploadError.message);
        } else {
          const { data: urlData } = client.storage
            .from('logos')
            .getPublicUrl(path);
          faviconUrl = urlData.publicUrl;
        }
      }

      // Sanitize colors
      const safePrimary = hexColorRegex.test(data.primaryColor)
        ? data.primaryColor
        : '#6366f1';
      const safeSecondary = hexColorRegex.test(data.secondaryColor)
        ? data.secondaryColor
        : '#8b5cf6';

      // Update workspace
      const updateData: Record<string, unknown> = {
        brand_primary_color: safePrimary,
        brand_secondary_color: safeSecondary,
      };

      if (logoUrl) updateData.logo_url = logoUrl;
      if (faviconUrl) updateData.favicon_url = faviconUrl;
      if (data.customDomain) updateData.custom_domain = data.customDomain;

      const { error: updateError } = await client
        .from('workspaces')
        .update(updateData)
        .eq('id', workspaces.id);

      if (updateError) {
        console.warn('Update do workspace falhou:', updateError.message);
        // Non-fatal — colors/domain can be set later
      }

      // Update setup step (will silently fail due to platform_config RLS — expected)
      await client
        .from('platform_config')
        .update({ setup_step: 3 })
        .not('id', 'is', null);

      // Apply CSS variables immediately
      document.documentElement.style.setProperty('--brand-primary', safePrimary);
      document.documentElement.style.setProperty('--brand-secondary', safeSecondary);

      toast.success('Configuracao visual salva');
      setCurrentStep(5);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configuracao';
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
            <Palette className="h-5 w-5 text-[#3B82F6]" />
          </div>
          <div>
            <CardTitle>Aparencia da Plataforma</CardTitle>
            <CardDescription>
              Configure a aparência visual da sua plataforma.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Logo upload */}
          <div className="space-y-2">
            <Label>Logo da Plataforma</Label>
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-[rgba(59,130,246,0.4)]"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="h-full w-full rounded-lg object-contain"
                  />
                ) : (
                  <Upload className="h-5 w-5 text-[#94A3B8]" />
                )}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'logo')}
              />
              <p className="text-xs text-[#94A3B8]">
                PNG, JPG ou SVG. Recomendado: 200x50px.
              </p>
            </div>
          </div>

          {/* Favicon upload */}
          <div className="space-y-2">
            <Label>Favicon</Label>
            <div className="flex items-center gap-4">
              <div
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded border-2 border-dashed hover:border-[rgba(59,130,246,0.4)]"
                onClick={() => faviconInputRef.current?.click()}
              >
                {faviconPreview ? (
                  <img
                    src={faviconPreview}
                    alt="Favicon"
                    className="h-full w-full rounded object-contain"
                  />
                ) : (
                  <Upload className="h-4 w-4 text-[#94A3B8]" />
                )}
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                className="hidden"
                onChange={(e) => handleFileSelect(e, 'favicon')}
              />
              <p className="text-xs text-[#94A3B8]">ICO ou PNG. 32x32px.</p>
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Cor Primaria</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  className="h-9 w-12 cursor-pointer rounded border"
                  onChange={(e) => {
                    const event = {
                      target: {
                        name: 'primaryColor',
                        value: e.target.value,
                      },
                    };
                    register('primaryColor').onChange(event);
                  }}
                />
                <Input
                  id="primaryColor"
                  {...register('primaryColor')}
                  className="flex-1"
                />
              </div>
              {errors.primaryColor && (
                <p className="text-sm text-red-400">{errors.primaryColor.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Cor Secundaria</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  className="h-9 w-12 cursor-pointer rounded border"
                  onChange={(e) => {
                    const event = {
                      target: {
                        name: 'secondaryColor',
                        value: e.target.value,
                      },
                    };
                    register('secondaryColor').onChange(event);
                  }}
                />
                <Input
                  id="secondaryColor"
                  {...register('secondaryColor')}
                  className="flex-1"
                />
              </div>
              {errors.secondaryColor && (
                <p className="text-sm text-red-400">
                  {errors.secondaryColor.message}
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-xs font-medium text-[#94A3B8]">
              Preview
            </p>
            <div className="flex gap-3">
              <div
                className="h-8 w-8 rounded"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="h-8 w-8 rounded"
                style={{ backgroundColor: secondaryColor }}
              />
              <div className="flex flex-1 items-center">
                <div
                  className="h-2 w-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Custom domain */}
          <div className="space-y-2">
            <Label htmlFor="customDomain">
              Dominio Customizado{' '}
              <span className="text-[#94A3B8]">(opcional)</span>
            </Label>
            <Input
              id="customDomain"
              placeholder="app.suaempresa.com"
              {...register('customDomain')}
            />
            {errors.customDomain && (
              <p className="text-sm text-red-400">{errors.customDomain.message}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(3)}
              className="flex-1"
            >
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
