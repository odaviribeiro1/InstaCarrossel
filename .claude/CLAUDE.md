# CLAUDE.md — Content Hub

## Visão Geral

**Content Hub** é uma plataforma SaaS white-label de criação de carrosséis para Instagram, alimentada por IA. Empreendedores não técnicos compram a licença e aplicam sua própria marca (logo, cores, domínio customizado). O produto gera carrosséis automaticamente a partir de prompts, URLs, transcrições e links de vídeo, entregando resultados melhores que um designer humano.

- **Modelo**: White-label — Agentise fornece a plataforma; o cliente final coloca sua marca e revende/usa.
- **Produto standalone** — não faz parte do Agentise Chat.
- **Sem billing interno** — não há cobrança dentro da plataforma; o controle comercial é externo.
- **Idioma da interface**: pt-BR apenas.
- **Público-alvo**: Empreendedores não técnicos que querem ter sua própria ferramenta de carrosséis com marca própria.

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Canvas/Editor | **Konva.js** (react-konva) — editor de slides baseado em canvas com layers, drag-and-drop, z-index, máscaras |
| Backend | Supabase Cloud **do cliente** (Database, Auth, Edge Functions, Realtime, Cron/pg_cron) — credenciais inseridas via Wizard |
| Storage | Supabase Storage **do cliente** (imagens, fontes, assets, exports) |
| Auth | Supabase Auth **do cliente** — email/senha |
| Deploy Frontend | Vercel (cada cliente white-label configura seu próprio domínio na Vercel) |
| Exportação | **Client-side via Konva.js** (`stage.toDataURL()` / `stage.toBlob()`) — PNG 1080x1350, formato 4:5. Canvas offscreen com dimensões exatas para qualidade consistente |
| Filas/Jobs | Supabase pg_cron + **pg_net** (HTTP) → Edge Functions (agendamento de posts) |
| Transcrição | **Supadata API** para YouTube; fallback com Whisper API para Reels/vídeos diretos |
| Geração de imagens | **Gemini Imagen** (Nano Banana Pro) via Google AI API — usuário insere própria API key |
| LLM | Multi-provider — usuário insere própria API key e escolhe provider (OpenAI, Anthropic, Google, etc.) |
| Ícones embutidos | Lucide React |
| Shapes embutidos | Set SVG próprio (círculo, quadrado, retângulo, estrela, seta, balão, linha, triângulo) |
| Monorepo | **pnpm workspaces** — único repositório com resolução de packages via workspace protocol |

---

## Estrutura do Monorepo

```
content-hub/
├── apps/
│   └── web/                    # App React principal
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/         # shadcn/ui components
│       │   │   ├── editor/     # Componentes do editor Konva
│       │   │   ├── wizard/     # Wizard de onboarding
│       │   │   ├── preview/    # Preview de carrossel gerado por IA
│       │   │   └── layout/     # Shell, sidebar, navbar
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── supabase.ts
│       │   │   ├── ai/         # Clients multi-provider LLM + Imagen
│       │   │   ├── export/     # Lógica de exportação PNG
│       │   │   ├── meta/       # Meta Content Publishing API
│       │   │   └── transcription/ # YouTube/Reels/Twitter extraction
│       │   ├── stores/         # Zustand stores
│       │   ├── types/
│       │   └── utils/
│       └── public/
├── supabase/
│   ├── migrations/             # SQL migrations
│   ├── functions/              # Edge Functions
│   │   ├── bootstrap/          # Setup inicial — recebe migrations, executa via Service Role Key (server-side)
│   │   ├── generate-content/   # Proxy LLM — busca API key do banco, chama provider server-side
│   │   ├── generate-image/     # Proxy Gemini Imagen — mesma lógica de segurança
│   │   ├── meta-oauth/         # Token exchange OAuth Meta (server-side, App Secret nunca no browser)
│   │   ├── schedule-post/      # Agendamento Instagram
│   │   ├── transcribe/         # Proxy transcrição — Supadata/Whisper (API key server-side)
│   │   └── webhook-meta/       # Webhooks Meta API
│   └── seed.sql
├── packages/
│   └── shared/                 # Types, utils compartilhados
├── CLAUDE.md
└── package.json
```

---

## Modelo de Dados (Supabase/Postgres)

### Tabelas Principais

```sql
-- Multi-tenancy
workspaces (
  id uuid PK,
  name text,
  slug text UNIQUE,
  custom_domain text UNIQUE,    -- domínio white-label do cliente (com índice)
  logo_url text,
  favicon_url text,
  brand_primary_color text,     -- cor primária da plataforma white-label
  brand_secondary_color text,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
)

workspace_members (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  user_id uuid FK → auth.users,
  role text CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
)

-- Brand Kit por workspace (identidade visual dos carrosséis)
brand_kits (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  name text,
  colors jsonb,                 -- { primary, secondary, accent, background, text }
  fonts jsonb,                  -- { heading: { family, url }, body: { family, url } }
  logo_url text,
  avatar_url text,
  tone_of_voice text,           -- instrução textual para IA ("fale de forma descontraída, use emojis")
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Config de IA do workspace
ai_configs (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  llm_provider text,            -- 'openai' | 'anthropic' | 'google' | 'groq' | etc.
  llm_api_key text,             -- encrypted
  llm_model text,               -- ex: 'gpt-4o', 'claude-sonnet-4-20250514'
  imagen_api_key text,           -- Google AI API key (Gemini Imagen)
  supadata_api_key text,         -- Supadata API key para transcrição (encrypted)
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
)

-- Templates
templates (
  id uuid PK,
  workspace_id uuid FK → workspaces NULL, -- NULL = template global do sistema
  name text,
  category text CHECK (category IN ('educacional', 'vendas', 'storytelling', 'antes_depois', 'lista', 'cta')),
  is_system boolean DEFAULT false,
  thumbnail_url text,
  slide_count_default int,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
)

-- Variações de layout por posição do slide dentro do template
template_slide_variants (
  id uuid PK,
  template_id uuid FK → templates,
  slide_position text,          -- 'capa' | 'conteudo' | 'cta' | 'transicao'
  variant_name text,            -- ex: "Capa Minimalista", "Capa Bold"
  layout_json jsonb,            -- estrutura Konva serializada (posição de elementos, placeholders)
  thumbnail_url text
)

-- Carrosséis
carousels (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  created_by uuid FK → auth.users,
  title text,
  status text DEFAULT 'draft',  -- 'draft' | 'ready' | 'scheduled' | 'published'
  brand_kit_id uuid FK → brand_kits NULL,
  template_id uuid FK → templates NULL,
  slide_count int,
  ai_input jsonb,               -- { type: 'url'|'text'|'video', content, topic, audience, tone }
  scheduled_at timestamptz,
  published_at timestamptz,
  meta_post_id text,            -- ID do post no Instagram após publicação
  version int DEFAULT 1,
  created_at timestamptz,
  updated_at timestamptz
)

-- Slides individuais
carousel_slides (
  id uuid PK,
  carousel_id uuid FK → carousels ON DELETE CASCADE,
  workspace_id uuid FK → workspaces,  -- desnormalizado para simplificar RLS
  position int,
  canvas_json jsonb,            -- estado completo do Konva stage serializado
  thumbnail_url text,           -- preview PNG em baixa resolução
  export_url text               -- PNG exportado 1080x1350
)

-- Versionamento
carousel_versions (
  id uuid PK,
  carousel_id uuid FK → carousels,
  workspace_id uuid FK → workspaces,  -- desnormalizado para simplificar RLS
  version int,
  snapshot_json jsonb,          -- snapshot completo de todos os slides
  created_at timestamptz,
  created_by uuid FK → auth.users
)

-- Fontes customizadas
custom_fonts (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  family_name text,
  font_url text,                -- URL no Supabase Storage
  format text,                  -- 'woff2' | 'ttf' | 'otf'
  weight text DEFAULT '400',    -- '100'-'900' ou 'normal'|'bold'
  style text DEFAULT 'normal',  -- 'normal' | 'italic'
  created_at timestamptz DEFAULT now()
)

-- Meta OAuth tokens
meta_connections (
  id uuid PK,
  workspace_id uuid FK → workspaces,
  user_id uuid FK → auth.users,
  access_token text,            -- encrypted
  ig_user_id text,
  fb_page_id text,
  token_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz DEFAULT now()
)

-- Posts agendados
scheduled_posts (
  id uuid PK,
  carousel_id uuid FK → carousels,
  workspace_id uuid FK → workspaces,
  scheduled_at timestamptz,
  status text DEFAULT 'pending', -- 'pending' | 'publishing' | 'published' | 'failed'
  error_message text,
  meta_post_id text,
  published_at timestamptz
)

-- Controle de migrações incrementais
schema_versions (
  id uuid PK DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,   -- ex: '001', '002'
  migration_name text NOT NULL,   -- ex: '001_initial_schema'
  applied_at timestamptz DEFAULT now()
)
```

### RLS (Row Level Security)

Todas as tabelas com `workspace_id` devem ter RLS habilitado. Políticas:
- SELECT/INSERT/UPDATE/DELETE: `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`
- **Exceção `templates`**: policy de SELECT deve incluir templates globais: `workspace_id IS NULL OR workspace_id IN (...)`. INSERT/UPDATE/DELETE devem exigir `workspace_id IS NOT NULL` (impedir modificação de templates globais por usuários).
- **`platform_config`**: RLS bloqueia 100% do acesso via anon key. Leitura de status via função RPC `SECURITY DEFINER` (ver seção Segurança).
- **`schema_versions`**: RLS habilitado, apenas SELECT via anon key. INSERT/UPDATE/DELETE apenas via service role.
- **`template_slide_variants`**: policy via subquery em `templates` — `template_id IN (SELECT id FROM templates WHERE workspace_id IS NULL OR workspace_id IN (...))`.
- Roles restritivos — **implementar policies granulares por role**, não apenas por workspace:
  - `viewer`: apenas SELECT
  - `editor`: SELECT, INSERT, UPDATE em carousels e carousel_slides
  - `admin`: tudo exceto DELETE workspace
  - `owner`: tudo
- **Helper SQL**: criar função `get_user_role(p_workspace_id uuid)` para evitar repetição nas policies:
  ```sql
  CREATE FUNCTION get_user_role(p_workspace_id uuid)
  RETURNS text AS $$
    SELECT role FROM workspace_members
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1;
  $$ LANGUAGE sql SECURITY DEFINER STABLE;
  ```

---

## Funcionalidades Detalhadas

### 1. Wizard de Onboarding (primeiro acesso)

Fluxo em 7 steps:
1. **Conectar Supabase** — inserir Supabase URL, Anon Key, Service Role Key → validar conexão → executar migrations via Edge Function `bootstrap` (ver Segurança)
2. **Criar workspace** — nome, slug
3. **White-label** — upload logo, favicon, cores primária/secundária da interface, domínio customizado
4. **Brand Kit** — upload logo do carrossel, definir cores (color picker), escolher/importar fontes, avatar, escrever tom de voz
5. **Configurar IA** — escolher LLM provider, inserir API key LLM, inserir Gemini Imagen key, inserir Supadata API key (transcrição)
6. **Conectar Instagram** — inserir Meta App ID + App Secret, iniciar fluxo OAuth via Edge Function `meta-oauth` (token exchange server-side)
7. **Gerar primeiro carrossel** — input de tema/URL, preview, aceitar/rejeitar, editar

Cada step salva o progresso no banco. Se o usuário sair e voltar, retoma do step onde parou (campo `setup_step` em `platform_config`).

**Segurança do Wizard:**
- **Step 1 (Setup Supabase)**: O cliente deve deployar a Edge Function `bootstrap` no seu Supabase **antes** do Wizard. Essa Edge Function usa a Service Role Key nativa do Deno (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`) para executar migrations server-side. O frontend envia apenas o SQL das migrations para a Edge Function — a Service Role Key **nunca trafega pelo browser**.
- **Step 1 (Validação de URL)**: Validar que `supabase_url` segue padrão `https://*.supabase.co`. Alertar se o domínio não for Supabase reconhecido. Validar formato das API keys (tamanho, charset).
- **Step 6 (Meta OAuth)**: Token exchange feito via Edge Function `meta-oauth` (App Secret nunca exposto no browser). Implementar `state` parameter (CSRF token) no fluxo OAuth. Validar `redirect_uri` contra whitelist de domínios autorizados.

### 2. Geração de Carrossel por IA

**Fluxo principal:**
1. Usuário escolhe **fonte de conteúdo**: texto livre, URL de blog, link YouTube, link Reels, link Twitter/X thread
2. Se URL de vídeo → sistema extrai transcrição automaticamente via API de transcrição
3. Usuário define: tema, tom de voz (ou usa do Brand Kit), público-alvo, quantidade de slides
4. Usuário escolhe **categoria de template** (educacional, vendas, etc.)
5. Frontend envia request à **Edge Function `generate-content`** (proxy), que:
   - Busca API key do LLM provider do banco (descriptografa server-side)
   - Monta prompt com: conteúdo/transcrição, tom de voz do Brand Kit, categoria e estrutura do template
   - Chama o LLM provider server-side (API key nunca exposta no browser)
   - Instrução para retornar JSON estruturado com texto por slide
6. Edge Function retorna JSON com conteúdo textual de cada slide
7. Sistema aplica o conteúdo nos placeholders do template (variante escolhida ou auto-selecionada)
8. **Tela de preview** — usuário vê todos os slides lado a lado
9. Usuário **aceita** (vai pro editor) ou **rejeita** (regenera ou edita prompt)

**Prompt Engineering:**
- Manter system prompt genérico que funcione com qualquer LLM provider
- Response format: JSON com array de slides, cada um com `{ position, type, headline, body, cta, notes }`
- Incluir instrução de tom de voz do Brand Kit no prompt
- Limitar tokens de saída proporcionalmente ao número de slides

### 3. Editor de Carrossel (Konva.js)

**Visão geral dos slides**: painel lateral esquerdo com thumbnails de todos os slides, reordenáveis via drag-and-drop.

**Canvas principal**: slide ativo renderizado em Konva Stage (1080x1350 virtual, escalado para caber na tela).

**Painel de propriedades** (direita): editar propriedades do elemento selecionado (cor, fonte, tamanho, posição, opacidade, rotação).

**Toolbar superior**:
- Adicionar: Texto, Imagem (upload), Shape, Ícone (Lucide picker), QR Code, Logo (do Brand Kit), Avatar (do Brand Kit), Gráfico
- Gerar imagem com IA (Gemini Imagen) — prompt textual → imagem inserida no slide
- Undo/Redo
- Zoom

**Funcionalidades do editor**:
- Layers com z-index controlável (painel de layers)
- Snap to grid / smart guides
- Máscaras de imagem (clip com shapes)
- Agrupamento de elementos
- Copiar/colar elementos entre slides
- Suporte a vídeo/GIF em slides (via Konva `Image` com vídeo source)
- Texto editável inline no canvas
- Aplicar Brand Kit (cores/fontes) a qualquer momento

### 4. Exportação

- **PNG por slide**: renderização **client-side via Konva.js**
  - Usa `stage.toDataURL({ pixelRatio: 2 })` ou `stage.toBlob()` em canvas offscreen (1080x1350)
  - Upload do PNG para Supabase Storage
  - Salva URL em `carousel_slides.export_url`
  - Fontes customizadas já estão carregadas no browser via FontFace API — sem problema de disponibilidade
- **Download em lote**: ZIP com todos os slides PNG (gerado client-side via JSZip ou similar)

### 5. Publicação no Instagram

- **Meta Content Publishing API** via Facebook Login OAuth
- Fluxo OAuth: usuário inicia conexão → redirect para Meta → authorization code retornado → **Edge Function `meta-oauth`** faz token exchange server-side (App Secret nunca exposto no browser) → access token armazenado encrypted via Vault
- Implementar `state` parameter (CSRF token) no fluxo OAuth — gerar valor aleatório, armazenar em sessão, validar no callback
- Validar `redirect_uri` contra whitelist de domínios autorizados
- Renovação automática de tokens via Edge Function + pg_cron antes da expiração
- Publicação de carrossel: upload dos PNGs como media objects → create carousel container → publish
- **Agendamento nativo**: usuário escolhe data/hora → `scheduled_posts` com `pg_cron` + `pg_net` (extensão HTTP do Postgres) para invocar a Edge Function `schedule-post` na hora certa

### 6. Versionamento

- A cada "salvar" significativo (ou ao sair do editor), cria-se uma entry em `carousel_versions`
- Snapshot completo do `canvas_json` de todos os slides
- Usuário pode ver histórico e restaurar versão anterior

### 7. Templates

**5 templates iniciais do sistema** (is_system = true), um por categoria:
1. Educacional — slides clean com numeração, headline + body
2. Vendas — CTA forte, cores vibrantes, urgência
3. Storytelling — visual imersivo, texto sobre imagem
4. Antes/Depois — layout split side-by-side
5. Lista — bullet points visuais, ícones

**Variações por posição de slide**:
- Capa: 3 variações (minimalista, bold, imagem full)
- Conteúdo: 5 variações (texto-only, texto+imagem, citação, estatística, bullet list)
- CTA: 2 variações (clean, urgência)
- Transição: 2 variações (pergunta, statement)

Usuário pode **salvar próprios templates** a partir de um carrossel editado.

### 8. White-Label

Configurações do white-label por workspace:
- Logo da plataforma (navbar, login)
- Favicon
- Cores primária e secundária da interface (CSS variables)
- Domínio customizado (cliente configura na Vercel)
- Toda a interface renderiza com a marca do cliente; "Agentise" / "Content Hub" não aparece em nenhum lugar

Implementação:
- No load da app, buscar workspace config pelo domínio (`custom_domain` match via `window.location.hostname`)
- **Fallback para desenvolvimento**: se domínio não encontrado (localhost), resolver via slug na URL (`/workspace-slug/...`) ou usar workspace padrão
- Injetar CSS variables dinâmicas: `--brand-primary`, `--brand-secondary`
- Substituir logo/favicon dinamicamente

### 9. Multi-Tenancy & Permissões

- Um user pode pertencer a múltiplos workspaces
- Workspace switcher no navbar
- Roles: owner > admin > editor > viewer
- Sem limite de membros ou carrosséis por workspace
- RLS garante isolamento total de dados entre workspaces

---

## Convenções de Código

### Geral
- TypeScript strict mode
- Path aliases: `@/` → `apps/web/src/`
- Componentes: PascalCase, um componente por arquivo
- Hooks: `use` prefix, em `hooks/`
- Utils: funções puras em `utils/` ou `lib/`
- Types: em `types/`, exportar interfaces (não types quando possível)
- Estado global: Zustand (stores em `stores/`)
- Formulários: React Hook Form + Zod validation
- Queries: TanStack Query (React Query) para todas as chamadas Supabase
- Toasts: sonner
- Modais: Dialog do shadcn/ui

### Estilo
- Tailwind utility-first, sem CSS custom exceto CSS variables do white-label
- shadcn/ui como base de componentes — customizar via Tailwind, não override CSS
- Responsivo: mobile-first, mas foco desktop (editor não precisa funcionar em mobile)
- Dark mode: não no MVP

### Supabase
- Migrations incrementais numeradas: `001_initial_schema.sql`, `002_add_fonts.sql`
- **Migrations são bundled no frontend** em `src/lib/migrations/` como strings SQL exportadas (100% estáticas, sem interpolação de input)
- O Wizard envia migrations à Edge Function `bootstrap`, que executa server-side via Service Role Key nativa
- RLS em TODAS as tabelas com workspace_id
- Edge Functions em TypeScript (Deno) — deploy automatizado via `npx content-hub deploy-functions` (o cliente roda antes do Wizard). Cada Edge Function valida `auth.uid()` contra `workspace_members` antes de acessar dados sensíveis
- Nomes de tabelas: snake_case, plural
- Colunas: snake_case
- Sempre `created_at timestamptz DEFAULT now()` e `updated_at timestamptz DEFAULT now()` em tabelas mutáveis
- Usar **Supabase Vault** (pgsodium) para criptografia de secrets — não armazenar chave junto dos dados
- Cada migration envolta em transaction; registrar em `schema_versions` após execução

### Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`
- Branch: `main` (produção), `dev` (desenvolvimento)
- Feature branches: `feat/nome-da-feature`

---

## Fluxo de Desenvolvimento com Claude Code

### Ordem de Implementação Sugerida

**Fase 1 — Fundação & Wizard**
1. Setup monorepo (pnpm workspaces + Vite + React + Tailwind + shadcn/ui)
2. SQL migrations script (todas as tabelas incluindo `platform_config` e `schema_versions`)
3. Edge Function `bootstrap` (executa migrations server-side via Service Role Key nativa)
4. Script `npx content-hub deploy-functions` (automatiza deploy de Edge Functions no Supabase do cliente)
5. Wizard Step 1: Conectar Supabase (input URL + Anon Key → validar → chamar Edge Function `bootstrap`)
6. Supabase client dinâmico (`localStorage` bootstrap) + função RPC `get_setup_status()`
7. Auth (email/senha via Supabase Auth do cliente)
8. Wizard Step 2-3: Criar workspace + White-label (CSS variables dinâmicas, logo, domínio)
9. Multi-tenancy (workspace CRUD, member management, RLS granular por role)
10. Wizard Step 5-6: Config IA + Conectar Instagram (Meta OAuth via Edge Function `meta-oauth`)

**Fase 2 — Brand Kit & Templates**
6. Brand Kit CRUD (cores, fontes, logo, tom de voz)
7. Upload de fontes customizadas + font-face injection
8. Sistema de templates (CRUD, categorias, variações por slide)
9. 5 templates iniciais do sistema (seed data + layouts JSON)

**Fase 3 — IA**
11. Config de IA por workspace (provider picker, API key storage via Supabase Vault)
12. Edge Function `generate-content` — proxy LLM multi-provider (adapter pattern: OpenAI, Anthropic, Google, Groq). API keys descriptografadas server-side, nunca expostas no browser. Rate limiting por workspace.
13. Edge Function `transcribe` — proxy para Supadata/Whisper API (mesma lógica de segurança)
14. Edge Function `generate-image` — proxy para Gemini Imagen (mesma lógica de segurança)
15. Geração de conteúdo: frontend → Edge Function → LLM → JSON de slides (validação Zod rigorosa no output)
16. Extração de transcrição (YouTube, Reels, Twitter) via Edge Function
17. Tela de preview (aceitar/rejeitar)

**Fase 4 — Editor**
15. Editor Konva.js (Stage, Layers, elementos básicos)
16. Painel de slides (thumbnails, reordenar)
17. Toolbar de elementos (texto, imagem, shape, ícone)
18. Painel de propriedades (sidebar direita)
19. Layers panel com z-index
20. Smart guides / snap
21. Máscaras de imagem
22. Geração de imagem com Gemini Imagen no editor
23. Undo/Redo (Zustand middleware)
24. Suporte a vídeo/GIF

**Fase 5 — Export & Publicação**
25. Export PNG client-side (Konva `stage.toDataURL()` em canvas offscreen + upload Supabase Storage)
26. Download em lote (ZIP client-side via JSZip)
27. Meta OAuth integration
28. Publicação no Instagram via API
29. Agendador nativo (pg_cron + pg_net para invocar Edge Functions)
30. Webhooks de eventos (carousel.created, carousel.exported, carousel.published)

**Fase 6 — Polish**
31. Versionamento de carrosséis
32. Salvar template customizado
33. QR Code generator
34. Gráficos (mini chart component)

---

## Variáveis de Ambiente

**NÃO EXISTEM variáveis de ambiente fixas.** Todas as credenciais são configuradas pelo usuário via Wizard no frontend e armazenadas no próprio Supabase do cliente.

O app é um frontend estático deployado na Vercel — zero backend próprio. Toda a infra é do cliente.

### Credenciais Gerenciadas via Wizard

| Credencial | Onde é inserida | Onde é armazenada |
|---|---|---|
| Supabase URL | Wizard Step 1 | `localStorage` (bootstrap) + tabela `platform_config` |
| Supabase Anon Key | Wizard Step 1 | `localStorage` (bootstrap) + tabela `platform_config` |
| Supabase Service Role Key | **Nunca inserida no browser** | Env var nativa do Deno nas Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`) |
| Meta App ID | Wizard Step 6 | tabela `platform_config` |
| Meta App Secret | Wizard Step 6 | tabela `platform_config` (encrypted via Vault) — token exchange via Edge Function `meta-oauth` |
| LLM Provider + API Key | Wizard Step 5 | tabela `ai_configs` (encrypted via Vault) |
| Gemini Imagen API Key | Wizard Step 5 | tabela `ai_configs` (encrypted via Vault) |
| Supadata API Key (transcrição) | Wizard Step 5 | tabela `ai_configs` (encrypted via Vault) |

### Tabela `platform_config` (singleton por instância)

```sql
platform_config (
  id uuid PK DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  -- Service Role Key NÃO é armazenada aqui — disponível como env var nativa nas Edge Functions
  meta_app_id text,
  meta_app_secret text,                      -- encrypted via Supabase Vault (pgsodium)
  setup_completed boolean DEFAULT false,
  setup_step int DEFAULT 1,                  -- step atual do Wizard (1-7) para retomada granular
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

**Criptografia**: usar **Supabase Vault** (baseado em pgsodium) para todos os secrets (API keys, tokens OAuth). O Vault gerencia chaves de criptografia separadamente, eliminando o anti-pattern de armazenar chave junto dos dados.

**Acesso a `platform_config`**: RLS bloqueia 100% do acesso via anon key. Frontend consulta status via função RPC `get_setup_status()` (SECURITY DEFINER). Edge Functions acessam via service role (env var nativa do Deno).

### Fluxo de Bootstrap (primeira vez)

**Pré-requisito**: o cliente deve deployar as Edge Functions no seu Supabase antes de iniciar o Wizard (fornecer script `npx content-hub deploy-functions` para automatizar).

1. App carrega → verifica `localStorage` por `supabase_url` e `supabase_anon_key`
2. Se não encontra → exibe **Wizard Step 1** (tela de setup Supabase)
3. Usuário insere: Supabase URL e Anon Key (Service Role Key **não é mais inserida no browser**)
4. Frontend **valida a conexão** (tenta um `SELECT 1` via anon key)
5. Se válido → chama **Edge Function `bootstrap`** com as migrations SQL pendentes:
   - A Edge Function usa `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (env var nativa, server-side)
   - Verifica `schema_versions` para saber quais migrations já foram aplicadas
   - Executa apenas as faltantes, cada uma envolta em transaction
   - Registra cada migration em `schema_versions`
   - Cria a row em `platform_config` (sem `supabase_service_role_key` — não precisa mais armazenar)
6. Salva `supabase_url` e `supabase_anon_key` no `localStorage`
7. Wizard continua para os próximos steps

### Fluxo de Bootstrap (retorno)

1. App carrega → encontra `supabase_url` e `supabase_anon_key` no `localStorage`
2. Cria Supabase client dinamicamente
3. Verifica status via **função RPC `get_setup_status()`** (SECURITY DEFINER — retorna apenas `setup_completed` + `setup_step`, sem expor dados sensíveis):
   ```sql
   CREATE FUNCTION get_setup_status()
   RETURNS TABLE(setup_completed boolean, setup_step int) AS $$
     SELECT setup_completed, setup_step FROM platform_config LIMIT 1;
   $$ LANGUAGE sql SECURITY DEFINER;
   ```
4. Se `setup_completed = true` → carrega app normalmente (verificar migrations pendentes via Edge Function `bootstrap`)
5. Se não → retoma Wizard do step indicado em `setup_step`

### Client Supabase Dinâmico

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  const url = localStorage.getItem('supabase_url')
  const anonKey = localStorage.getItem('supabase_anon_key')

  if (!url || !anonKey) return null

  return createClient(url, anonKey)
}

export const supabase = getSupabaseClient()
```

O client é criado sob demanda. Se não existir (primeiro acesso), a app renderiza o Wizard.

---

## Segurança

### Princípios Fundamentais

1. **Service Role Key nunca toca o browser** — disponível apenas como env var nativa nas Edge Functions
2. **API keys nunca expostas no frontend** — todas as chamadas a providers externos proxiadas via Edge Functions
3. **RLS granular por role** — policies checam role explicitamente, não apenas presença em workspace
4. **Secrets via Supabase Vault** — nunca armazenar chave de criptografia junto dos dados
5. **Validação em todas as fronteiras** — inputs do Wizard, respostas de IA, uploads de arquivos, canvas_json

### Edge Functions como Barreira de Segurança

Todas as Edge Functions devem:
1. Validar JWT do usuário (Supabase Auth)
2. Verificar que o usuário pertence ao workspace via `workspace_members`
3. Descriptografar API keys server-side via Supabase Vault
4. Implementar rate limiting por workspace
5. Sanitizar inputs e validar outputs

### Uploads e Storage

- Buckets **privados** com signed URLs (expiração curta)
- Validar MIME type real via magic bytes (não extensão)
- Limites de tamanho: fontes max 2MB, imagens max 10MB
- Whitelist de MIME types no Supabase Storage
- Servir com `Content-Disposition: attachment`

### Headers de Segurança (Vercel)

Configurar em `vercel.json`:
- `Content-Security-Policy`: restritivo — bloquear scripts inline e de terceiros
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- CORS: cada cliente deve configurar no Supabase Dashboard com domínio exato (nunca wildcard `*`)

### Checklist de Segurança Pré-Deploy

- [ ] Edge Functions deployadas (`npx content-hub deploy-functions`)
- [ ] RLS habilitado em todas as tabelas
- [ ] `platform_config` inacessível via anon key
- [ ] CORS configurado com domínio específico no Supabase
- [ ] Rate limiting ativo nas Edge Functions
- [ ] Supabase Vault habilitado para criptografia
- [ ] CSP headers configurados na Vercel
- [ ] Meta OAuth redirect_uri na whitelist

---

## Regras Importantes

1. **Nunca exibir** "Content Hub", "Agentise" ou qualquer marca fixa na interface — tudo vem do workspace config.
2. **API keys do usuário** devem ser encrypted at rest via **Supabase Vault** (pgsodium). Nunca armazenar chave de criptografia na mesma tabela dos dados.
3. **Exportação client-side** deve ser idempotente — mesmo input = mesmo output. Usar canvas offscreen com dimensões exatas (1080x1350).
4. **LLM adapter** deve ser extensível — adicionar novo provider = criar um arquivo novo, não alterar os existentes.
5. **Templates JSON** (layout_json) devem ser versionados — se a estrutura mudar, manter backward compatibility.
6. **RLS é obrigatório** — nenhuma query deve funcionar sem workspace context.
7. **Todas as respostas de IA** passam por parsing + validação Zod antes de serem usadas.
8. **O editor NÃO precisa funcionar em mobile** — exibir mensagem "Use no desktop" em telas < 1024px.
9. **Fontes customizadas** devem ser carregadas via FontFace API antes de renderizar o canvas.
10. **Zero env vars** — a app não depende de nenhuma variável de ambiente. Tudo é configurado no Wizard e armazenado no Supabase do cliente.
11. **Migrations bundled** — SQL de migrations embutido no frontend como strings importadas. Enviadas à Edge Function `bootstrap` para execução server-side. Migrations são 100% estáticas — ZERO input de usuário concatenado em SQL.
12. **Service Role Key nunca toca o browser** — disponível apenas como env var nativa nas Edge Functions (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`). Migrations executadas server-side via Edge Function `bootstrap`.
13. **Workspace resolution**: no load, resolver workspace pelo `window.location.hostname` → query `workspaces.custom_domain`. Fallback para slug na URL em ambiente de desenvolvimento (localhost).
14. **Chamadas a APIs externas (LLM, transcrição, Imagen)** devem ser sempre proxiadas via Edge Functions. O frontend nunca deve ter acesso direto às API keys dos providers — keys são descriptografadas server-side na Edge Function.
15. **Migrations incrementais**: usar tabela `schema_versions` para rastrear quais migrations já foram aplicadas. No boot e no setup, executar apenas as pendentes via Edge Function `bootstrap`. Cada migration envolta em transaction.
16. **Concorrência no editor**: implementar locking simples via campo `editing_by` + timestamp no carrossel. No futuro, considerar CRDTs para colaboração real-time.
17. **pg_cron + pg_net**: o `pg_cron` executa SQL, não HTTP. Usar a extensão `pg_net` para invocar Edge Functions a partir de cron jobs.
18. **Upload de arquivos**: validar MIME type real via magic bytes (não apenas extensão). Limitar tamanho (fontes: max 2MB, imagens: max 10MB). Configurar Supabase Storage com whitelist de MIME types. Buckets privados com signed URLs.
19. **CSP (Content Security Policy)**: configurar headers restritivos na Vercel — bloquear scripts inline e de terceiros. Previne XSS e mitigação contra extensões maliciosas.
20. **Sanitização de CSS variables**: validar formato hex/rgb antes de injetar cores dinâmicas em `--brand-primary`/`--brand-secondary`. Rejeitar valores que não sejam cores válidas.
21. **Validação de canvas_json**: definir schema Zod para validação no save e no load. Limitar tamanho máximo (5MB). Rejeitar URLs com protocolos não-HTTPS (prevenir `javascript:` URLs).
22. **Prompt injection**: usar delimitadores claros no prompt (`<user_content>...</user_content>`) para separar instruções do sistema. Validar output do LLM com schema Zod rigoroso. Nunca executar código retornado pelo LLM.
23. **Rate limiting**: implementar nas Edge Functions (usando Deno.kv ou Supabase como state store). Rate limit por workspace (ex: max 100 gerações IA/dia). Usar rate limit nativo do Supabase Auth para login.
24. **OAuth Meta**: token exchange sempre server-side via Edge Function. Implementar `state` parameter (CSRF). Validar `redirect_uri` contra whitelist. Revogar token na desconexão.
25. **platform_config inacessível via anon key**: RLS bloqueia 100%. Frontend usa função RPC `get_setup_status()` (SECURITY DEFINER) para ler apenas `setup_completed` e `setup_step`.
26. **RLS granular por role**: policies devem checar role explicitamente via helper SQL `get_user_role()`, não apenas presença em `workspace_members`.