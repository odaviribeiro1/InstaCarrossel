import Konva from 'konva';
import type { EditorSlide } from '@/stores/editor-store';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renders a slide to PNG using an offscreen Konva Stage.
 * Ensures fonts are loaded before rendering.
 */
export async function exportSlideToPng(slide: EditorSlide): Promise<Blob> {
  // Wait for all fonts to be loaded
  await document.fonts.ready;

  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({
      container,
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    // Background
    const bg = new Konva.Rect({
      x: 0,
      y: 0,
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      fill: slide.backgroundColor,
    });
    layer.add(bg);

    // Add elements
    for (const element of slide.elements) {
      if (!element.visible) continue;

      let node: Konva.Node | null = null;

      const attrs = { ...element.attrs };
      // Remove non-Konva attrs
      delete attrs.draggable;
      delete attrs.placeholder;
      // Only delete src for non-Image types
      if (element.type !== 'Image') {
        delete attrs.src;
      }

      switch (element.type) {
        case 'Rect':
          node = new Konva.Rect(attrs);
          break;
        case 'Text':
          node = new Konva.Text(attrs);
          break;
        case 'Circle':
          node = new Konva.Circle(attrs);
          break;
        case 'Line':
          node = new Konva.Line(attrs);
          break;
        case 'Star':
          node = new Konva.Star(attrs as Konva.StarConfig);
          break;
        case 'Arrow':
          node = new Konva.Arrow(attrs as Konva.ArrowConfig);
          break;
        case 'RegularPolygon':
          node = new Konva.RegularPolygon(attrs as Konva.RegularPolygonConfig);
          break;
        case 'Image': {
          const imgEl = await loadImage(String(attrs.src ?? ''));
          delete attrs.src;
          node = new Konva.Image({ ...attrs, image: imgEl } as Konva.ImageConfig);
          break;
        }
      }

      if (node) {
        layer.add(node as Konva.Shape);
      }
    }

    layer.draw();

    // Export to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      stage.toBlob({
        pixelRatio: 2,
        mimeType: 'image/png',
        callback: (b) => {
          if (b) resolve(b);
          else reject(new Error('Falha ao gerar PNG'));
        },
      });
    });

    stage.destroy();
    return blob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Exports all slides and uploads to Supabase Storage.
 */
export async function exportAllSlides(
  slides: EditorSlide[],
  carouselId: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const { getSupabaseClient } = await import('@/lib/supabase');
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase nao configurado');

  const urls: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!slide) continue;

    onProgress?.(i + 1, slides.length);

    const blob = await exportSlideToPng(slide);
    const path = `${carouselId}/slide-${String(i + 1).padStart(2, '0')}.png`;

    const { error: uploadError } = await client.storage
      .from('exports')
      .upload(path, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = await client.storage
      .from('exports')
      .createSignedUrl(path, 3600);

    const signedUrl = urlData?.signedUrl ?? '';
    urls.push(signedUrl);

    // Update slide export_url
    await client
      .from('carousel_slides')
      .update({ export_url: signedUrl })
      .eq('id', slide.id);
  }

  return urls;
}
