import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabase';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface CustomFont {
  id: string;
  family_name: string;
  font_url: string;
  format: string;
}

const MAGIC_BYTES: Record<string, number[]> = {
  woff2: [0x77, 0x4f, 0x46, 0x32],
  ttf: [0x00, 0x01, 0x00, 0x00],
  otf: [0x4f, 0x54, 0x54, 0x4f],
};

/**
 * Validates font file MIME type via magic bytes (not extension).
 */
export function validateFontMagicBytes(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer, 0, 4);
  for (const [format, magic] of Object.entries(MAGIC_BYTES)) {
    if (magic.every((b, i) => bytes[i] === b)) {
      return format;
    }
  }
  return null;
}

/**
 * Loads custom fonts for the active workspace via FontFace API.
 * Ensures fonts are loaded before canvas rendering.
 */
export function useFontLoader() {
  const { activeWorkspace } = useWorkspaceStore();
  const [loaded, setLoaded] = useState(false);
  const [fontFamilies, setFontFamilies] = useState<string[]>([]);

  const { data: fonts } = useQuery({
    queryKey: ['custom-fonts', activeWorkspace?.id],
    queryFn: async () => {
      const client = getSupabaseClient();
      if (!client || !activeWorkspace) return [];
      const { data } = await client
        .from('custom_fonts')
        .select('*')
        .eq('workspace_id', activeWorkspace.id);
      return (data ?? []) as CustomFont[];
    },
    enabled: Boolean(activeWorkspace),
  });

  useEffect(() => {
    if (!fonts || fonts.length === 0) {
      setLoaded(true);
      return;
    }

    async function loadFonts() {
      const families: string[] = [];

      for (const font of fonts!) {
        try {
          // Get signed URL for private bucket
          const client = getSupabaseClient();
          if (!client) continue;

          const fontUrl = font.font_url;

          const fontFace = new FontFace(
            font.family_name,
            `url(${fontUrl})`,
            { display: 'swap' }
          );

          const loadedFont = await fontFace.load();
          document.fonts.add(loadedFont);
          families.push(font.family_name);
        } catch (err) {
          console.warn(`Falha ao carregar fonte ${font.family_name}:`, err);
        }
      }

      setFontFamilies(families);
      setLoaded(true);
    }

    void loadFonts();
  }, [fonts]);

  return { loaded, fontFamilies, customFonts: fonts ?? [] };
}
