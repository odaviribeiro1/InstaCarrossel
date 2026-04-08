import { z } from 'zod';

export const slideContentSchema = z.object({
  position: z.number(),
  type: z.enum(['capa', 'conteudo', 'cta', 'transicao']),
  headline: z.string(),
  body: z.string(),
  cta: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const generatedContentSchema = z.object({
  slides: z.array(slideContentSchema).min(1).max(20),
});

export type SlideContent = z.infer<typeof slideContentSchema>;
export type GeneratedContent = z.infer<typeof generatedContentSchema>;

export const canvasJsonSchema = z.object({
  width: z.number().default(1080),
  height: z.number().default(1350),
  elements: z.array(
    z.object({
      type: z.string(),
      attrs: z.record(z.unknown()),
    })
  ).default([]),
}).passthrough();

export type CanvasJson = z.infer<typeof canvasJsonSchema>;
