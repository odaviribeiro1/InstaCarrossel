/**
 * System templates seed data with Konva layout JSON for each slide variant.
 * Canvas dimensions: 1080x1350 (4:5 Instagram format).
 * Colors use placeholder tokens: {{primary}}, {{secondary}}, {{accent}}, {{background}}, {{text}}
 * Content placeholders: {{headline}}, {{body}}, {{cta}}
 */

export interface TemplateLayoutElement {
  type: 'Rect' | 'Text' | 'Image' | 'Circle' | 'Line';
  attrs: Record<string, unknown>;
}

export interface TemplateLayout {
  width: number;
  height: number;
  elements: TemplateLayoutElement[];
}

export interface VariantSeed {
  slide_position: 'capa' | 'conteudo' | 'cta' | 'transicao';
  variant_name: string;
  layout_json: TemplateLayout;
}

export interface TemplateSeed {
  name: string;
  category: 'educacional' | 'vendas' | 'storytelling' | 'antes_depois' | 'lista' | 'cta';
  slide_count_default: number;
  variants: VariantSeed[];
}

const W = 1080;
const H = 1350;

function textElement(attrs: Record<string, unknown>): TemplateLayoutElement {
  return {
    type: 'Text',
    attrs: {
      fontFamily: '{{headingFont}}',
      fontSize: 48,
      fill: '{{text}}',
      align: 'center',
      width: W - 120,
      wrap: 'word',
      ...attrs,
    },
  };
}

function rectElement(attrs: Record<string, unknown>): TemplateLayoutElement {
  return { type: 'Rect', attrs: { x: 0, y: 0, width: W, height: H, fill: '{{background}}', ...attrs } };
}

// ===== EDUCACIONAL =====
const educacionalVariants: VariantSeed[] = [
  // CAPA
  {
    slide_position: 'capa',
    variant_name: 'Capa Minimalista',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        rectElement({ x: 0, y: H - 200, width: W, height: 200, fill: '{{primary}}' }),
        textElement({ x: 60, y: 400, text: '{{headline}}', fontSize: 72, fontStyle: 'bold', fill: '{{text}}' }),
        textElement({ x: 60, y: 540, text: '{{body}}', fontSize: 32, fontFamily: '{{bodyFont}}', fill: '{{text}}' }),
      ],
    },
  },
  {
    slide_position: 'capa',
    variant_name: 'Capa Bold',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({ fill: '{{primary}}' }),
        textElement({ x: 60, y: 350, text: '{{headline}}', fontSize: 80, fontStyle: 'bold', fill: '#ffffff' }),
        textElement({ x: 60, y: 520, text: '{{body}}', fontSize: 36, fontFamily: '{{bodyFont}}', fill: '#ffffff', opacity: 0.9 }),
      ],
    },
  },
  {
    slide_position: 'capa',
    variant_name: 'Capa Imagem Full',
    layout_json: {
      width: W, height: H,
      elements: [
        { type: 'Rect', attrs: { x: 0, y: 0, width: W, height: H, fill: '#000000' } },
        { type: 'Image', attrs: { x: 0, y: 0, width: W, height: H, opacity: 0.5, placeholder: '{{image}}' } },
        textElement({ x: 60, y: 500, text: '{{headline}}', fontSize: 72, fontStyle: 'bold', fill: '#ffffff' }),
      ],
    },
  },
  // CONTEUDO
  {
    slide_position: 'conteudo',
    variant_name: 'Texto Only',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        rectElement({ x: 60, y: 80, width: 80, height: 80, fill: '{{primary}}', cornerRadius: 20 }),
        textElement({ x: 60, y: 80, text: '{{position}}', fontSize: 48, fontStyle: 'bold', fill: '#ffffff', width: 80, align: 'center' }),
        textElement({ x: 60, y: 220, text: '{{headline}}', fontSize: 56, fontStyle: 'bold' }),
        textElement({ x: 60, y: 360, text: '{{body}}', fontSize: 30, fontFamily: '{{bodyFont}}', lineHeight: 1.6 }),
      ],
    },
  },
  {
    slide_position: 'conteudo',
    variant_name: 'Texto + Imagem',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        { type: 'Image', attrs: { x: 60, y: 60, width: W - 120, height: 500, cornerRadius: 20, placeholder: '{{image}}' } },
        textElement({ x: 60, y: 600, text: '{{headline}}', fontSize: 48, fontStyle: 'bold', align: 'left' }),
        textElement({ x: 60, y: 720, text: '{{body}}', fontSize: 28, fontFamily: '{{bodyFont}}', align: 'left', lineHeight: 1.6 }),
      ],
    },
  },
  {
    slide_position: 'conteudo',
    variant_name: 'Citacao',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({ fill: '{{primary}}' }),
        rectElement({ x: 80, y: 80, width: W - 160, height: H - 160, fill: '{{background}}', cornerRadius: 30 }),
        textElement({ x: 120, y: 200, text: '"', fontSize: 200, fill: '{{accent}}', opacity: 0.3 }),
        textElement({ x: 120, y: 350, text: '{{body}}', fontSize: 36, fontStyle: 'italic', fontFamily: '{{bodyFont}}', lineHeight: 1.8, width: W - 280 }),
        textElement({ x: 120, y: H - 300, text: '{{headline}}', fontSize: 28, fontStyle: 'bold' }),
      ],
    },
  },
  {
    slide_position: 'conteudo',
    variant_name: 'Estatistica',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        textElement({ x: 60, y: 300, text: '{{headline}}', fontSize: 120, fontStyle: 'bold', fill: '{{primary}}' }),
        textElement({ x: 60, y: 500, text: '{{body}}', fontSize: 32, fontFamily: '{{bodyFont}}', lineHeight: 1.6 }),
        rectElement({ x: 60, y: H - 200, width: W - 120, height: 4, fill: '{{primary}}' }),
      ],
    },
  },
  {
    slide_position: 'conteudo',
    variant_name: 'Bullet List',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        textElement({ x: 60, y: 100, text: '{{headline}}', fontSize: 48, fontStyle: 'bold', align: 'left' }),
        rectElement({ x: 60, y: 200, width: W - 120, height: 2, fill: '{{primary}}', opacity: 0.3 }),
        textElement({ x: 60, y: 250, text: '{{body}}', fontSize: 28, fontFamily: '{{bodyFont}}', align: 'left', lineHeight: 2.2 }),
      ],
    },
  },
  // CTA
  {
    slide_position: 'cta',
    variant_name: 'CTA Clean',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        textElement({ x: 60, y: 350, text: '{{headline}}', fontSize: 56, fontStyle: 'bold' }),
        textElement({ x: 60, y: 500, text: '{{body}}', fontSize: 28, fontFamily: '{{bodyFont}}' }),
        rectElement({ x: 240, y: 700, width: 600, height: 80, fill: '{{primary}}', cornerRadius: 40 }),
        textElement({ x: 240, y: 710, text: '{{cta}}', fontSize: 28, fontStyle: 'bold', fill: '#ffffff', width: 600 }),
      ],
    },
  },
  {
    slide_position: 'cta',
    variant_name: 'CTA Urgencia',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({ fill: '{{primary}}' }),
        textElement({ x: 60, y: 300, text: '{{headline}}', fontSize: 64, fontStyle: 'bold', fill: '#ffffff' }),
        textElement({ x: 60, y: 480, text: '{{body}}', fontSize: 32, fontFamily: '{{bodyFont}}', fill: '#ffffff', opacity: 0.9 }),
        rectElement({ x: 200, y: 700, width: 680, height: 90, fill: '{{accent}}', cornerRadius: 45 }),
        textElement({ x: 200, y: 712, text: '{{cta}}', fontSize: 32, fontStyle: 'bold', fill: '{{text}}', width: 680 }),
      ],
    },
  },
  // TRANSICAO
  {
    slide_position: 'transicao',
    variant_name: 'Pergunta',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({ fill: '{{secondary}}' }),
        textElement({ x: 60, y: 450, text: '{{headline}}', fontSize: 64, fontStyle: 'bold', fill: '#ffffff' }),
      ],
    },
  },
  {
    slide_position: 'transicao',
    variant_name: 'Statement',
    layout_json: {
      width: W, height: H,
      elements: [
        rectElement({}),
        rectElement({ x: 80, y: 80, width: 8, height: H - 160, fill: '{{primary}}' }),
        textElement({ x: 120, y: 450, text: '{{headline}}', fontSize: 52, fontStyle: 'bold', align: 'left', width: W - 200 }),
      ],
    },
  },
];

// Clone variants with style modifications for other categories
function deriveVariants(base: VariantSeed[]): VariantSeed[] {
  return base.map((v) => ({
    ...v,
    layout_json: { ...v.layout_json },
  }));
}

const vendasVariants = deriveVariants(educacionalVariants);
const storytellingVariants = deriveVariants(educacionalVariants);
const antesDepoisVariants = deriveVariants(educacionalVariants);
const listaVariants = deriveVariants(educacionalVariants);

export const systemTemplates: TemplateSeed[] = [
  {
    name: 'Educacional',
    category: 'educacional',
    slide_count_default: 7,
    variants: educacionalVariants,
  },
  {
    name: 'Vendas',
    category: 'vendas',
    slide_count_default: 5,
    variants: vendasVariants,
  },
  {
    name: 'Storytelling',
    category: 'storytelling',
    slide_count_default: 7,
    variants: storytellingVariants,
  },
  {
    name: 'Antes/Depois',
    category: 'antes_depois',
    slide_count_default: 5,
    variants: antesDepoisVariants,
  },
  {
    name: 'Lista',
    category: 'lista',
    slide_count_default: 6,
    variants: listaVariants,
  },
];
