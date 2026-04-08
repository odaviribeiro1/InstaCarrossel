export interface Workspace {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface BrandKit {
  id: string;
  workspace_id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: { family: string; url: string };
    body: { family: string; url: string };
  };
  logo_url: string | null;
  avatar_url: string | null;
  tone_of_voice: string | null;
  is_default: boolean;
}

export interface AiConfig {
  id: string;
  workspace_id: string;
  llm_provider: string;
  llm_api_key_id: string | null;
  llm_model: string;
  imagen_api_key_id: string | null;
  supadata_api_key_id: string | null;
  created_at: string;
}

export interface PlatformConfig {
  id: string;
  supabase_url: string;
  supabase_anon_key: string;
  meta_app_id: string | null;
  meta_app_secret_id: string | null;
  setup_completed: boolean;
  setup_step: number;
  created_at: string;
}

export type CarouselStatus = 'draft' | 'ready' | 'scheduled' | 'published';

export interface Carousel {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  status: CarouselStatus;
  brand_kit_id: string | null;
  template_id: string | null;
  slide_count: number;
  ai_input: {
    type: 'url' | 'text' | 'video';
    content: string;
    topic?: string;
    audience?: string;
    tone?: string;
  } | null;
  scheduled_at: string | null;
  published_at: string | null;
  meta_post_id: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CarouselSlide {
  id: string;
  carousel_id: string;
  workspace_id: string;
  position: number;
  canvas_json: Record<string, unknown>;
  thumbnail_url: string | null;
  export_url: string | null;
}

export type TemplateCategory =
  | 'educacional'
  | 'vendas'
  | 'storytelling'
  | 'antes_depois'
  | 'lista'
  | 'cta';

export type SlidePosition = 'capa' | 'conteudo' | 'cta' | 'transicao';

export interface Template {
  id: string;
  workspace_id: string | null;
  name: string;
  category: TemplateCategory;
  is_system: boolean;
  thumbnail_url: string | null;
  slide_count_default: number;
  created_at: string;
}

export interface TemplateSlideVariant {
  id: string;
  template_id: string;
  slide_position: SlidePosition;
  variant_name: string;
  layout_json: Record<string, unknown>;
  thumbnail_url: string | null;
}
