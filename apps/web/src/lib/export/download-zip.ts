import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { EditorSlide } from '@/stores/editor-store';
import { exportSlideToPng } from './export-png';

/**
 * Exports all slides as a ZIP file of PNGs.
 */
export async function downloadSlidesAsZip(
  slides: EditorSlide[],
  filename: string = 'carrossel',
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (!slide) continue;

    onProgress?.(i + 1, slides.length);

    const blob = await exportSlideToPng(slide);
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${filename}.zip`);
}
