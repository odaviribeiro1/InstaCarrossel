# EPIC: Implementacao Completa da Arquitetura Content Hub

## Titulo do Epico

**Implementar a arquitetura completa do Content Hub conforme descrita em docs/architecture.md**

## Descricao

COMO desenvolvedor, QUERO implementar a arquitetura completa descrita em docs/architecture.md, PARA construir o projeto inteiro a partir do plano de arquitetura.

O Content Hub e uma plataforma SaaS white-label de criacao de carrosseis para Instagram, alimentada por IA. O projeto segue o modelo "zero backend proprio" onde toda a infraestrutura roda no Supabase do cliente e o frontend e um SPA estatico deployado na Vercel. A implementacao esta dividida em 6 fases sequenciais, cada uma construindo sobre as anteriores.

## Diagrama de Dependencias entre Fases

```
Fase 1 (Fundacao & Wizard)
    |
    +--------+--------+
    |                  |
    v                  v
Fase 2              Fase 3
(Brand Kit &        (Inteligencia
 Templates)          Artificial)
    |                  |
    +--------+--------+
             |
             v
         Fase 4
         (Editor Visual)
             |
             v
         Fase 5
         (Exportacao &
          Publicacao)
             |
             v
         Fase 6
         (Polish)
```

---

## Fase 1 - Fundacao & Wizard

**Objetivo**: Infraestrutura base, setup do monorepo, Wizard de onboarding completo, autenticacao e multi-tenancy.

**Dependencias**: Nenhuma (ponto de partida).

**Complexidade geral**: Alta. Fase mais critica pois define toda a base.

---

### Story 1.1 - Setup do Monorepo

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: Nenhuma

**Descricao**: Configurar o monorepo com pnpm workspaces, Vite, React 18, TypeScript strict mode, Tailwind CSS e shadcn/ui.

**Tasks**:
1. Inicializar monorepo com pnpm workspaces (`pnpm-workspace.yaml`).
2. Criar `apps/web/` com Vite + React 18 + TypeScript (strict mode).
3. Configurar Tailwind CSS com CSS variables para white-label (`--brand-primary`, `--brand-secondary`).
4. Instalar e configurar shadcn/ui (componentes base: Button, Input, Dialog, Card, Select, Tabs, Toast via sonner).
5. Criar `packages/shared/` para types e utils compartilhados.
6. Configurar path aliases (`@/` aponta para `apps/web/src/`).
7. Criar estrutura de pastas conforme CLAUDE.md:
   - `src/components/ui/`, `src/components/editor/`, `src/components/wizard/`, `src/components/preview/`, `src/components/layout/`
   - `src/pages/`, `src/hooks/`, `src/lib/`, `src/stores/`, `src/types/`, `src/utils/`
8. Instalar dependencias core: zustand, react-hook-form, zod, @tanstack/react-query, sonner, lucide-react.
9. Configurar `vercel.json` com headers de seguranca (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
10. Configurar ESLint + Prettier com regras do projeto.

**Criterios de Aceitacao**:
- [ ] `pnpm install` roda sem erros.
- [ ] `pnpm dev` inicia o servidor de desenvolvimento.
- [ ] `pnpm build` gera build de producao sem erros.
- [ ] TypeScript strict mode ativo (sem `any` implicito).
- [ ] shadcn/ui componentes renderizam corretamente.
- [ ] Path alias `@/` funciona em imports.
- [ ] Estrutura de pastas criada conforme especificacao.

---

### Story 1.2 - SQL Migrations

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 1.1

**Descricao**: Criar todas as migrations SQL que serao bundled no frontend e executadas pela Edge Function `bootstrap`. Inclui todas as tabelas, funcoes RPC, RLS policies e extensoes.

**Tasks**:
1. Criar `supabase/migrations/001_extensions.sql` - Habilitar extensoes: `pgcrypto`, `pgsodium`, `pg_net`, `pg_cron`.
2. Criar `supabase/migrations/002_platform_config.sql` - Tabela `platform_config` (singleton) + funcao RPC `get_setup_status()` (SECURITY DEFINER).
3. Criar `supabase/migrations/003_schema_versions.sql` - Tabela `schema_versions` para controle de migrations.
4. Criar `supabase/migrations/004_workspaces.sql` - Tabelas `workspaces` e `workspace_members` + indices + constraints UNIQUE.
5. Criar `supabase/migrations/005_brand_kits.sql` - Tabela `brand_kits` com campos jsonb para cores e fontes.
6. Criar `supabase/migrations/006_ai_configs.sql` - Tabela `ai_configs` com criptografia via Vault para API keys.
7. Criar `supabase/migrations/007_templates.sql` - Tabelas `templates` e `template_slide_variants`.
8. Criar `supabase/migrations/008_carousels.sql` - Tabelas `carousels`, `carousel_slides` (com `workspace_id` desnormalizado), `carousel_versions`.
9. Criar `supabase/migrations/009_custom_fonts.sql` - Tabela `custom_fonts`.
10. Criar `supabase/migrations/010_meta_connections.sql` - Tabelas `meta_connections` e `scheduled_posts`.
11. Criar `supabase/migrations/011_rls_policies.sql` - RLS em todas as tabelas + policies granulares por role usando `get_user_role()`.
12. Criar `supabase/migrations/012_storage_buckets.sql` - Buckets privados (logos, avatars, fonts, exports, images).
13. Bundlar migrations como strings exportadas em `src/lib/migrations/index.ts`.

**Criterios de Aceitacao**:
- [ ] Todas as tabelas do modelo de dados criadas conforme architecture.md.
- [ ] Funcao `get_user_role()` criada como SECURITY DEFINER STABLE.
- [ ] Funcao `get_setup_status()` criada como SECURITY DEFINER.
- [ ] RLS habilitado em todas as tabelas com `workspace_id`.
- [ ] `platform_config` inacessivel via anon key (RLS bloqueia 100%).
- [ ] Templates globais (`workspace_id IS NULL`) acessiveis via SELECT por qualquer usuario autenticado.
- [ ] `carousel_slides` possui `workspace_id` desnormalizado.
- [ ] Migrations bundled em `src/lib/migrations/index.ts` como strings SQL exportadas.
- [ ] Cada migration envolta em transaction e registrada em `schema_versions`.

---

### Story 1.3 - Edge Function Bootstrap

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.2

**Descricao**: Criar a Edge Function `bootstrap` que recebe migrations SQL estaticas do frontend e as executa server-side usando a Service Role Key nativa. Criar tambem o script `npx content-hub deploy-functions`.

**Tasks**:
1. Criar `supabase/functions/bootstrap/index.ts` (Deno runtime).
2. Implementar validacao de JWT do usuario.
3. Implementar execucao de migrations SQL recebidas (strings estaticas, sem interpolacao).
4. Usar `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` para execucao privilegiada.
5. Registrar cada migration executada em `schema_versions`.
6. Implementar idempotencia (verificar `schema_versions` antes de executar).
7. Retornar status de cada migration (sucesso/ja executada/erro).
8. Criar script `deploy-functions` em `packages/shared/bin/` para automatizar deploy das Edge Functions.

**Criterios de Aceitacao**:
- [ ] Edge Function recebe array de migrations SQL e executa em ordem.
- [ ] Migrations ja executadas sao ignoradas (idempotencia via `schema_versions`).
- [ ] Service Role Key nunca e recebida do frontend (usa env var nativa).
- [ ] Erros em uma migration nao afetam migrations anteriores (transaction por migration).
- [ ] Retorna JSON com status de cada migration.

---

### Story 1.4 - Supabase Client Dinamico e Bootstrap da App

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.1

**Descricao**: Implementar a criacao dinamica do Supabase client a partir de valores no localStorage, o fluxo de bootstrap da aplicacao e a verificacao de setup.

**Tasks**:
1. Criar `src/lib/supabase.ts` com funcao `getSupabaseClient()` que le `supabase_url` e `supabase_anon_key` do localStorage.
2. Implementar singleton reativo - se credenciais mudarem, recriar o client.
3. Criar hook `useSupabase()` que retorna o client ou `null`.
4. Criar hook `useBootstrap()` que verifica o estado do setup:
   - Sem credenciais no localStorage -> renderizar Wizard Step 1.
   - Com credenciais -> verificar `platform_config.setup_completed` via RPC `get_setup_status()`.
   - `setup_completed = false` -> retomar Wizard do step salvo em `setup_step`.
   - `setup_completed = true` -> carregar app normalmente.
5. Criar componente `<BootstrapProvider>` que envolve a app e gerencia o fluxo.
6. Criar pagina de fallback/loading durante verificacao do bootstrap.

**Criterios de Aceitacao**:
- [ ] Supabase client criado dinamicamente a partir do localStorage.
- [ ] Primeiro acesso (sem localStorage) renderiza Wizard Step 1.
- [ ] Retorno com setup incompleto retoma Wizard do step correto.
- [ ] Retorno com setup completo carrega app normalmente.
- [ ] Apenas `supabase_url` e `supabase_anon_key` sao armazenados no localStorage.

---

### Story 1.5 - Wizard Step 1: Conectar Supabase

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.3, 1.4

**Descricao**: Implementar o primeiro step do Wizard onde o usuario insere credenciais do Supabase, valida a conexao e executa as migrations via Edge Function.

**Tasks**:
1. Criar componente `<WizardStep1Supabase>`.
2. Formulario com campos: Supabase URL, Anon Key.
3. Validacao de formato: URL deve seguir padrao `https://*.supabase.co`; API keys validadas por tamanho e charset (Zod).
4. Botao "Testar Conexao" que faz `SELECT 1` via anon key.
5. Ao validar, chamar Edge Function `bootstrap` passando migrations bundled.
6. Progress bar mostrando execucao de cada migration.
7. Em caso de sucesso, salvar `supabase_url` e `supabase_anon_key` no localStorage.
8. Criar row inicial em `platform_config` com `setup_step = 1`, `setup_completed = false`.
9. Tratamento de erros com mensagens claras (conexao recusada, key invalida, Edge Function nao encontrada).
10. Exibir instrucao para deployar Edge Functions caso a Edge Function `bootstrap` nao seja encontrada.

**Criterios de Aceitacao**:
- [ ] Formulario valida formato de URL e API key antes de testar.
- [ ] Conexao testada com `SELECT 1` e feedback visual (sucesso/erro).
- [ ] Migrations executadas via Edge Function com progress indicator.
- [ ] Credenciais salvas no localStorage apos sucesso.
- [ ] Mensagem clara caso Edge Functions nao estejam deployadas.
- [ ] Service Role Key nunca e solicitada ao usuario no browser.

---

### Story 1.6 - Autenticacao (Supabase Auth)

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.4

**Descricao**: Implementar autenticacao com email/senha usando Supabase Auth do cliente, incluindo registro, login, logout e protecao de rotas.

**Tasks**:
1. Criar pagina de Login (`/login`) com email e senha.
2. Criar pagina de Registro (`/register`) com email, senha e confirmacao de senha.
3. Validacao de formularios com Zod (email valido, senha min 8 chars).
4. Integrar com `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`.
5. Criar store Zustand `useAuthStore` para estado de autenticacao.
6. Implementar hook `useAuth()` com estado do usuario, loading e metodos.
7. Criar componente `<ProtectedRoute>` que redireciona para login se nao autenticado.
8. Implementar listener `supabase.auth.onAuthStateChange()` para sessao reativa.
9. Pagina de recuperacao de senha.
10. Paginas de Login e Register devem renderizar com marca do workspace (se disponivel) - sem mencao a "Content Hub" ou "Agentise".

**Criterios de Aceitacao**:
- [ ] Usuario consegue se registrar com email/senha.
- [ ] Usuario consegue fazer login e logout.
- [ ] Rotas protegidas redirecionam para `/login` se nao autenticado.
- [ ] Estado de autenticacao persiste entre reloads (sessao Supabase).
- [ ] Nenhuma marca fixa exibida nas telas de auth.

---

### Story 1.7 - Wizard Steps 2-3: Workspace e White-Label

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.5, 1.6

**Descricao**: Implementar os steps 2 e 3 do Wizard: criacao do workspace e configuracao white-label com preview em tempo real.

**Tasks**:
1. Criar componente `<WizardStep2Workspace>`.
2. Formulario: nome do workspace, slug (auto-gerado a partir do nome, editavel).
3. Validacao de slug unico em tempo real (debounced query).
4. Criar registro em `workspaces` e `workspace_members` (usuario como owner).
5. Criar componente `<WizardStep3WhiteLabel>`.
6. Upload de logo (Supabase Storage bucket `logos`).
7. Upload de favicon (Supabase Storage bucket `logos`).
8. Color picker para cor primaria e secundaria.
9. Campo opcional de dominio customizado.
10. Preview em tempo real: aplicar cores como CSS variables e exibir mini-preview da interface.
11. Sanitizacao de cores (validar formato hex/rgb antes de injetar CSS variables).
12. Atualizar `platform_config.setup_step` a cada step concluido.

**Criterios de Aceitacao**:
- [ ] Workspace criado com slug unico.
- [ ] Usuario registrado como owner do workspace em `workspace_members`.
- [ ] Logo e favicon uploadados para Supabase Storage.
- [ ] Cores aplicadas como CSS variables (`--brand-primary`, `--brand-secondary`).
- [ ] Preview em tempo real reflete as cores escolhidas.
- [ ] Cores validadas antes da injecao (prevencao de CSS injection).
- [ ] `setup_step` atualizado no `platform_config` a cada step.

---

### Story 1.8 - Multi-Tenancy e Gerenciamento de Membros

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 1.7

**Descricao**: Implementar o sistema completo de multi-tenancy com workspace switcher, CRUD de membros e resolucao de workspace por dominio.

**Tasks**:
1. Criar store Zustand `useWorkspaceStore` com workspace ativo.
2. Implementar resolucao de workspace por hostname (`window.location.hostname` -> `workspaces.custom_domain`). Fallback para slug na URL em localhost.
3. Criar componente `<WorkspaceSwitcher>` no navbar (dropdown com workspaces do usuario).
4. Criar pagina de gerenciamento de membros (`/settings/members`).
5. CRUD de membros: convidar (por email), alterar role, remover.
6. Restringir acoes por role:
   - Owner: tudo, incluindo deletar workspace.
   - Admin: tudo exceto deletar workspace.
   - Editor: SELECT, INSERT, UPDATE em carousels e carousel_slides.
   - Viewer: apenas SELECT.
7. Criar componente `<RoleGuard>` que renderiza filhos apenas se o usuario tiver o role minimo.
8. Implementar layout shell (`<AppShell>`) com sidebar, navbar e area de conteudo.
9. Injetar CSS variables do workspace ativo no layout.
10. Substituir logo e favicon dinamicamente com base no workspace ativo.

**Criterios de Aceitacao**:
- [ ] Workspace resolvido por hostname (custom_domain) ou slug (localhost).
- [ ] Workspace switcher funciona para usuarios em multiplos workspaces.
- [ ] Membros podem ser convidados, editados e removidos.
- [ ] Acoes restritas por role (owner, admin, editor, viewer).
- [ ] CSS variables, logo e favicon aplicados dinamicamente por workspace.
- [ ] RLS garante isolamento total entre workspaces.

---

### Story 1.9 - Wizard Steps 5-6: Config IA e Instagram

**Prioridade**: P1
**Complexidade**: L
**Dependencias**: 1.7

**Descricao**: Implementar os steps 5 e 6 do Wizard: configuracao de IA (provider, API keys) e conexao com Instagram via Meta OAuth.

**Tasks**:
1. Criar componente `<WizardStep5AI>`.
2. Dropdown de LLM provider (OpenAI, Anthropic, Google, Groq).
3. Campo de API key do LLM.
4. Campo de API key do Gemini Imagen.
5. Campo de API key da Supadata (transcricao).
6. Salvar em `ai_configs` com API keys encrypted via Vault.
7. Criar componente `<WizardStep6Instagram>`.
8. Campos: Meta App ID e App Secret.
9. Salvar App ID/Secret em `platform_config` (Secret encrypted via Vault).
10. Botao "Conectar Instagram" que inicia fluxo OAuth.
11. Gerar `state` parameter (CSRF token) e armazenar em sessao.
12. Redirect para Meta OAuth authorization URL.
13. Criar Edge Function `meta-oauth` para token exchange server-side.
14. Callback handler: receber authorization code, enviar para Edge Function, receber access token.
15. Edge Function armazena access token encrypted via Vault em `meta_connections`.
16. Selecao de pagina Facebook e perfil Instagram vinculado.
17. Validacao de `redirect_uri` contra whitelist.

**Criterios de Aceitacao**:
- [ ] Usuario seleciona provider e insere API keys.
- [ ] API keys armazenadas encrypted via Supabase Vault.
- [ ] Fluxo OAuth Meta funciona end-to-end.
- [ ] App Secret nunca exposto no browser (token exchange via Edge Function).
- [ ] State parameter validado (protecao CSRF).
- [ ] Access token armazenado encrypted via Vault.
- [ ] Usuario consegue selecionar pagina/perfil Instagram.

---

### Story 1.10 - Wizard Step 7: Gerar Primeiro Carrossel

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 1.9, 3.5 (parcial - pode usar stub)

**Descricao**: Implementar o step final do Wizard como validacao de que todo o setup funciona, gerando um carrossel de demonstracao.

**Tasks**:
1. Criar componente `<WizardStep7FirstCarousel>`.
2. Input de tema ou URL para geracao.
3. Chamar fluxo de geracao de carrossel (pode usar stub se Fase 3 nao estiver pronta).
4. Exibir preview dos slides gerados.
5. Opcoes: aceitar (ir para editor), rejeitar (regenerar), editar prompt.
6. Marcar `platform_config.setup_completed = true` e `setup_step = 7` ao aceitar.
7. Redirecionar para o editor/dashboard.

**Criterios de Aceitacao**:
- [ ] Usuario consegue inserir tema/URL.
- [ ] Preview de slides exibida (mesmo que com dados mock caso IA nao esteja pronta).
- [ ] Ao aceitar, `setup_completed = true` e salvo.
- [ ] App carrega normalmente em acessos subsequentes (nao re-exibe Wizard).

---

## Fase 2 - Brand Kit & Templates

**Objetivo**: Sistema de identidade visual e templates reutilizaveis.

**Dependencias**: Fase 1 (workspaces, auth, RLS).

**Complexidade geral**: Media.

---

### Story 2.1 - Brand Kit CRUD

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 1.8

**Descricao**: Implementar o CRUD completo de Brand Kits por workspace, incluindo cores, fontes, logo, avatar e tom de voz.

**Tasks**:
1. Criar pagina de Brand Kits (`/settings/brand-kits`).
2. Listar Brand Kits do workspace ativo.
3. Formulario de criacao/edicao:
   - Nome do Brand Kit.
   - Paleta de cores com color pickers: primary, secondary, accent, background, text (armazenar em jsonb `colors`).
   - Selecao de fontes para heading e body (Google Fonts + fontes customizadas).
   - Upload de logo para carrosseis (diferente do logo da plataforma).
   - Upload de avatar.
   - Campo de tom de voz (textarea com instrucao para IA).
4. Toggle `is_default` (apenas um Brand Kit padrao por workspace).
5. Delete com confirmacao.
6. Queries com TanStack Query (cache, invalidation).
7. Validacao com Zod em todos os formularios.

**Criterios de Aceitacao**:
- [ ] Brand Kits podem ser criados, editados, listados e deletados.
- [ ] Apenas um Brand Kit pode ser marcado como padrao por workspace.
- [ ] Cores armazenadas como jsonb com campos: primary, secondary, accent, background, text.
- [ ] Fontes armazenadas como jsonb com campos: heading (family, url), body (family, url).
- [ ] Logo e avatar uploadados para Supabase Storage.
- [ ] Tom de voz salvo como texto livre.

---

### Story 2.2 - Upload e Injecao de Fontes Customizadas

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 2.1

**Descricao**: Implementar upload de fontes customizadas (woff2, ttf, otf) e carregamento via FontFace API antes de renderizar o canvas.

**Tasks**:
1. Criar UI de upload de fontes na pagina de Brand Kit.
2. Validacao: MIME type real via magic bytes (nao extensao), max 2MB.
3. Upload para Supabase Storage (bucket `fonts`, privado, signed URLs).
4. Salvar registro em `custom_fonts` (family_name, font_url, format).
5. Criar hook `useFontLoader()` que carrega fontes via FontFace API.
6. Carregar todas as fontes do workspace ativo no mount da app.
7. Garantir que fontes estejam carregadas antes de renderizar canvas Konva.
8. Listar fontes customizadas disponiveis no font picker do editor.

**Criterios de Aceitacao**:
- [ ] Fontes customizadas podem ser uploadadas (woff2, ttf, otf).
- [ ] Validacao de MIME type real (magic bytes) e tamanho (max 2MB).
- [ ] Fontes carregadas via FontFace API e disponiveis para uso no canvas.
- [ ] Fontes carregam antes do canvas renderizar (sem FOUT).
- [ ] Fontes customizadas aparecem no font picker do editor.

---

### Story 2.3 - Sistema de Templates CRUD

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 1.8

**Descricao**: Implementar o sistema de templates com CRUD, categorias e variacoes por posicao de slide.

**Tasks**:
1. Criar pagina de Templates (`/templates`).
2. Listar templates por categoria (educacional, vendas, storytelling, antes_depois, lista, cta).
3. Exibir templates do sistema (`is_system = true`, `workspace_id = NULL`) e do workspace.
4. Formulario de criacao de template:
   - Nome, categoria (select).
   - Quantidade padrao de slides.
   - Thumbnail (auto-gerado ou upload).
5. CRUD de variacoes por posicao de slide (`template_slide_variants`):
   - Posicao: capa, conteudo, cta, transicao.
   - Nome da variacao (ex: "Capa Minimalista").
   - `layout_json`: estrutura Konva serializada com placeholders.
6. Preview de cada variacao (render do layout_json em mini canvas).
7. RLS: templates do sistema acessiveis por todos; templates do workspace apenas para membros.

**Criterios de Aceitacao**:
- [ ] Templates listados por categoria com filtro.
- [ ] Templates do sistema exibidos para todos os usuarios autenticados.
- [ ] Templates do workspace isolados por RLS.
- [ ] Variacoes por posicao de slide (capa, conteudo, cta, transicao) criadas e editaveis.
- [ ] `layout_json` armazena estrutura Konva serializada valida.
- [ ] Preview visual das variacoes.

---

### Story 2.4 - Templates Iniciais do Sistema (Seed)

**Prioridade**: P0
**Complexidade**: XL
**Dependencias**: 2.3

**Descricao**: Criar os 5 templates iniciais do sistema com todas as variacoes por posicao de slide, incluindo layouts JSON Konva detalhados.

**Tasks**:
1. **Template Educacional**: layout clean com numeracao, headline + body.
   - Capa: 3 variacoes (minimalista, bold, imagem full).
   - Conteudo: 5 variacoes (texto-only, texto+imagem, citacao, estatistica, bullet list).
   - CTA: 2 variacoes (clean, urgencia).
   - Transicao: 2 variacoes (pergunta, statement).
2. **Template Vendas**: CTA forte, cores vibrantes, urgencia.
   - Mesma estrutura de variacoes.
3. **Template Storytelling**: visual imersivo, texto sobre imagem.
   - Mesma estrutura de variacoes.
4. **Template Antes/Depois**: layout split side-by-side.
   - Mesma estrutura de variacoes.
5. **Template Lista**: bullet points visuais com icones.
   - Mesma estrutura de variacoes.
6. Cada variacao deve ter `layout_json` com:
   - Posicoes absolutas de elementos (x, y, width, height).
   - Placeholders para headline, body, cta, image.
   - Configuracoes de fonte (family, size, weight, color com referencia ao Brand Kit).
   - Shapes decorativos e background.
7. Criar migration de seed (`supabase/seed.sql`) com INSERT dos templates e variacoes.
8. Criar thumbnails para cada template e variacao.

**Criterios de Aceitacao**:
- [ ] 5 templates do sistema criados com `is_system = true` e `workspace_id = NULL`.
- [ ] Cada template tem 12 variacoes (3 capa + 5 conteudo + 2 CTA + 2 transicao).
- [ ] Total de 60 variacoes de layout JSON Konva.
- [ ] Layouts JSON sao validos e renderizaveis pelo Konva.js.
- [ ] Placeholders claros para conteudo dinamico (headline, body, cta).
- [ ] Templates carregam corretamente na UI de selecao.

---

## Fase 3 - Inteligencia Artificial

**Objetivo**: Geracao de conteudo, transcricao e geracao de imagens por IA.

**Dependencias**: Fase 1 (Edge Functions, ai_configs) + Fase 2 (Brand Kit, templates).

**Complexidade geral**: Alta.

---

### Story 3.1 - Configuracao de IA por Workspace

**Prioridade**: P0
**Complexidade**: S
**Dependencias**: 1.8

**Descricao**: Implementar a pagina de configuracao de IA com selecao de provider e gerenciamento de API keys (separada do Wizard, para edicao posterior).

**Tasks**:
1. Criar pagina `/settings/ai`.
2. Dropdown de provider (OpenAI, Anthropic, Google, Groq).
3. Campo de modelo (sugestoes por provider: gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash, etc.).
4. Campo de API key LLM (masked input, opcao de revelar).
5. Campo de API key Gemini Imagen.
6. Campo de API key Supadata.
7. Botao "Testar conexao" para cada provider (chamada leve via Edge Function).
8. Salvar em `ai_configs` com keys encrypted via Vault.

**Criterios de Aceitacao**:
- [ ] Configuracao de IA editavel apos o Wizard.
- [ ] API keys armazenadas encrypted via Vault.
- [ ] Teste de conexao funciona para cada provider.
- [ ] Inputs de API key mascarados por padrao.

---

### Story 3.2 - Edge Function generate-content (Proxy LLM Multi-Provider)

**Prioridade**: P0
**Complexidade**: XL
**Dependencias**: 1.3, 3.1

**Descricao**: Criar Edge Function que atua como proxy seguro para LLMs, implementando adapter pattern multi-provider com prompt engineering robusto.

**Tasks**:
1. Criar `supabase/functions/generate-content/index.ts`.
2. Validar JWT e pertencimento ao workspace.
3. Buscar `ai_configs` do workspace e descriptografar API key via Vault.
4. Implementar adapter pattern com interface comum:
   ```typescript
   interface LLMAdapter {
     generateContent(prompt: string, config: LLMConfig): Promise<LLMResponse>
   }
   ```
5. Criar adapters: `OpenAIAdapter`, `AnthropicAdapter`, `GoogleAdapter`, `GroqAdapter`.
6. Cada adapter em arquivo separado (Open/Closed principle).
7. Implementar system prompt generico que funcione com qualquer provider:
   - Incluir conteudo/transcricao com delimitadores claros (`<user_content>...</user_content>`).
   - Incluir tom de voz do Brand Kit.
   - Incluir categoria e estrutura do template.
   - Instruir retorno em JSON estruturado.
8. Implementar rate limiting por workspace (ex: max 100 geracoes/dia).
9. Retornar JSON com array de slides:
   ```json
   { "slides": [{ "position": 1, "type": "capa", "headline": "...", "body": "...", "cta": "...", "notes": "..." }] }
   ```
10. Limitar tokens de saida proporcionalmente ao numero de slides.

**Criterios de Aceitacao**:
- [ ] Edge Function proxia chamadas para OpenAI, Anthropic, Google e Groq.
- [ ] Adapter pattern: adicionar novo provider = criar novo arquivo sem alterar existentes.
- [ ] API key descriptografada server-side (nunca exposta ao browser).
- [ ] Prompt usa delimitadores claros para prevenir prompt injection.
- [ ] Rate limiting por workspace funciona.
- [ ] Retorno e JSON valido com array de slides.

---

### Story 3.3 - Edge Function transcribe (Proxy Transcricao)

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 1.3, 3.1

**Descricao**: Criar Edge Function para transcricao de videos (YouTube via Supadata, Reels/videos diretos via Whisper).

**Tasks**:
1. Criar `supabase/functions/transcribe/index.ts`.
2. Validar JWT e pertencimento ao workspace.
3. Detectar tipo de URL (YouTube, Instagram Reels, Twitter/X, video direto).
4. Para YouTube: chamar Supadata API com API key descriptografada.
5. Para Reels/videos diretos: chamar Whisper API como fallback.
6. Retornar transcricao como texto.
7. Cache de transcricoes para evitar chamadas duplicadas.
8. Rate limiting por workspace.

**Criterios de Aceitacao**:
- [ ] Transcricao de videos YouTube via Supadata funciona.
- [ ] Fallback para Whisper funciona para Reels/videos diretos.
- [ ] API keys descriptografadas server-side.
- [ ] Cache evita transcricoes duplicadas.

---

### Story 3.4 - Edge Function generate-image (Proxy Gemini Imagen)

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 1.3, 3.1

**Descricao**: Criar Edge Function para geracao de imagens via Gemini Imagen, usada no editor para gerar imagens por prompt.

**Tasks**:
1. Criar `supabase/functions/generate-image/index.ts`.
2. Validar JWT e pertencimento ao workspace.
3. Buscar `imagen_api_key` do `ai_configs` e descriptografar.
4. Chamar Google AI API (Gemini Imagen) com prompt recebido.
5. Retornar imagem (base64 ou URL temporaria).
6. Rate limiting por workspace.

**Criterios de Aceitacao**:
- [ ] Imagem gerada a partir de prompt textual.
- [ ] API key descriptografada server-side.
- [ ] Imagem retornada em formato utilizavel pelo frontend.
- [ ] Rate limiting funciona.

---

### Story 3.5 - Fluxo de Geracao de Carrossel no Frontend

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 3.2, 2.4

**Descricao**: Implementar o fluxo completo de geracao de carrossel no frontend: selecao de fonte de conteudo, configuracao, chamada a Edge Function, validacao Zod e aplicacao nos templates.

**Tasks**:
1. Criar pagina `/create` com fluxo em steps.
2. Step 1: Escolha de fonte de conteudo (texto livre, URL de blog, link YouTube, link Reels, link Twitter/X).
3. Se URL de video: chamar Edge Function `transcribe` automaticamente e exibir transcricao extraida.
4. Step 2: Configuracao do carrossel:
   - Tema/topico.
   - Tom de voz (padrao do Brand Kit ou customizado).
   - Publico-alvo.
   - Quantidade de slides.
5. Step 3: Selecao de categoria de template (educacional, vendas, storytelling, antes/depois, lista).
6. Chamar Edge Function `generate-content` com todos os parametros.
7. Validar resposta com schema Zod rigoroso.
8. Aplicar conteudo nos placeholders do template selecionado (variante auto-selecionada ou escolhida).
9. Criar registro em `carousels` e `carousel_slides`.

**Criterios de Aceitacao**:
- [ ] Usuario pode escolher entre 5 fontes de conteudo.
- [ ] Transcricao de video e extraida automaticamente.
- [ ] Configuracao de tema, tom de voz, publico e quantidade de slides funciona.
- [ ] Selecao de template por categoria funciona.
- [ ] Resposta da IA validada com Zod antes de uso.
- [ ] Conteudo aplicado nos placeholders do template.
- [ ] Carrossel e slides salvos no banco.

---

### Story 3.6 - Tela de Preview (Aceitar/Rejeitar)

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 3.5

**Descricao**: Implementar a tela de preview onde o usuario ve todos os slides gerados e decide aceitar, rejeitar ou editar.

**Tasks**:
1. Criar componente `<CarouselPreview>`.
2. Exibir todos os slides lado a lado (grid ou carousel horizontal).
3. Renderizar preview dos slides usando mini Konva Stage (read-only).
4. Botao "Aceitar" -> redirecionar para editor.
5. Botao "Rejeitar" -> opcoes: regenerar com mesmo prompt, editar prompt, voltar.
6. Botao "Editar Prompt" -> abrir modal para ajustar instrucoes e regenerar.
7. Loading state durante geracao.
8. Exibir conteudo textual de cada slide abaixo do preview visual.

**Criterios de Aceitacao**:
- [ ] Todos os slides exibidos lado a lado.
- [ ] Preview visual renderizado corretamente.
- [ ] Aceitar redireciona para editor com carrossel pronto.
- [ ] Rejeitar permite regenerar ou editar prompt.
- [ ] Loading state durante geracao.

---

## Fase 4 - Editor Visual (Konva.js)

**Objetivo**: Editor completo de carrosseis com canvas 2D.

**Dependencias**: Fase 2 (Brand Kit, templates) + Fase 3 (conteudo gerado por IA).

**Complexidade geral**: Muito Alta.

---

### Story 4.1 - Editor Base (Konva Stage e Elementos Basicos)

**Prioridade**: P0
**Complexidade**: XL
**Dependencias**: 2.1, 2.4

**Descricao**: Implementar o editor base com Konva Stage (1080x1350), renderizacao de elementos basicos (texto, imagem, shape) e selecao/transformacao de elementos.

**Tasks**:
1. Instalar `konva` e `react-konva`.
2. Criar componente `<EditorCanvas>` com Konva Stage (1080x1350 virtual, escalado para caber na tela).
3. Criar store Zustand `useEditorStore` com estado do carrossel:
   - Slides (array de objetos com elementos Konva serializados).
   - Slide ativo (indice).
   - Elemento selecionado.
   - Zoom level.
4. Renderizar elementos do `canvas_json`: Text, Image, Rect, Circle, Line, Star, Arrow, RegularPolygon.
5. Implementar selecao de elementos (click -> Transformer aparece).
6. Implementar drag-and-drop de elementos no canvas.
7. Implementar redimensionamento via Transformer handles.
8. Implementar rotacao via Transformer.
9. Implementar texto editavel inline (double-click para editar).
10. Serializar/deserializar estado do canvas para/de `canvas_json` (jsonb).
11. Exibir mensagem "Use no desktop" em telas < 1024px.
12. Layout em 3 paineis: slides (esquerda), canvas (centro), propriedades (direita).

**Criterios de Aceitacao**:
- [ ] Canvas Konva renderiza em 1080x1350 (escalado).
- [ ] Elementos basicos (texto, imagem, shapes) renderizam do `canvas_json`.
- [ ] Elementos selecionaveis, moviveis, redimensionaveis e rotacionaveis.
- [ ] Texto editavel inline com double-click.
- [ ] Estado serializado/deserializado corretamente para jsonb.
- [ ] Mensagem exibida em telas < 1024px.

---

### Story 4.2 - Painel de Slides (Thumbnails e Reordenacao)

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar o painel lateral esquerdo com thumbnails de todos os slides, reordenacao via drag-and-drop e adicao/remocao de slides.

**Tasks**:
1. Criar componente `<SlidePanel>` (painel lateral esquerdo).
2. Renderizar thumbnails de cada slide (mini canvas ou imagem estaatica).
3. Highlight do slide ativo.
4. Click no thumbnail seleciona o slide para edicao.
5. Drag-and-drop para reordenar slides (usando @dnd-kit ou similar).
6. Botao "Adicionar Slide" (insere slide vazio ou a partir de variacao de template).
7. Botao "Duplicar Slide" (copia slide selecionado).
8. Botao "Remover Slide" com confirmacao.
9. Atualizar `position` dos slides apos reordenacao.

**Criterios de Aceitacao**:
- [ ] Thumbnails de todos os slides exibidos no painel esquerdo.
- [ ] Click no thumbnail muda o slide ativo no canvas.
- [ ] Drag-and-drop reordena slides.
- [ ] Adicionar, duplicar e remover slides funciona.
- [ ] Posicoes atualizadas corretamente apos reordenacao.

---

### Story 4.3 - Toolbar de Elementos

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 4.1

**Descricao**: Implementar a toolbar superior com ferramentas para adicionar elementos ao canvas.

**Tasks**:
1. Criar componente `<EditorToolbar>`.
2. Botao **Texto**: adicionar caixa de texto com fonte do Brand Kit.
3. Botao **Imagem**: upload de imagem (file picker -> Supabase Storage -> adicionar ao canvas).
4. Botao **Shape**: dropdown com shapes SVG (circulo, quadrado, retangulo, estrela, seta, balao, linha, triangulo).
5. Botao **Icone**: picker de icones Lucide (busca por nome, categorias, 1000+ opcoes).
6. Botao **QR Code**: input de URL -> gerar QR code -> adicionar ao canvas.
7. Botao **Logo**: inserir logo do Brand Kit ativo.
8. Botao **Avatar**: inserir avatar do Brand Kit ativo.
9. Botao **Grafico**: mini chart component (stub para Fase 6).
10. Botao **IA Imagen**: abrir modal de prompt -> chamar Edge Function `generate-image` -> inserir imagem gerada no canvas.
11. Botoes **Undo/Redo**.
12. Controle de **Zoom** (slider + botoes +/-).

**Criterios de Aceitacao**:
- [ ] Cada tipo de elemento pode ser adicionado ao canvas pela toolbar.
- [ ] Upload de imagem funciona (file -> Storage -> canvas).
- [ ] Picker de icones Lucide funciona com busca.
- [ ] QR Code gerado a partir de URL.
- [ ] Logo e avatar do Brand Kit inseridos corretamente.
- [ ] Geracao de imagem por IA funciona via Edge Function.
- [ ] Zoom funciona (in/out).

---

### Story 4.4 - Painel de Propriedades

**Prioridade**: P0
**Complexidade**: L
**Dependencias**: 4.1

**Descricao**: Implementar o painel lateral direito com propriedades editaveis do elemento selecionado, contextual por tipo de elemento.

**Tasks**:
1. Criar componente `<PropertiesPanel>` (sidebar direita).
2. Exibir propriedades comuns a todos os elementos:
   - Posicao (x, y).
   - Tamanho (width, height).
   - Rotacao (graus).
   - Opacidade (slider 0-100).
3. Propriedades de **Texto**:
   - Familia da fonte (picker com fontes do Brand Kit + Google Fonts + customizadas).
   - Tamanho da fonte.
   - Peso (bold/normal).
   - Cor do texto (color picker).
   - Alinhamento (esquerda, centro, direita).
   - Line height, letter spacing.
4. Propriedades de **Imagem**:
   - Trocar imagem.
   - Crop/fit mode.
   - Borda (cor, espessura, raio).
5. Propriedades de **Shape**:
   - Cor de preenchimento.
   - Cor de borda.
   - Espessura de borda.
   - Raio de borda (para retangulos).
6. Estado vazio: quando nenhum elemento selecionado, exibir propriedades do slide (cor de fundo).
7. Atualizacao em tempo real: mudancas no painel refletem imediatamente no canvas.

**Criterios de Aceitacao**:
- [ ] Painel exibe propriedades contextuais por tipo de elemento.
- [ ] Mudancas no painel refletem imediatamente no canvas.
- [ ] Font picker inclui fontes do Brand Kit, Google Fonts e customizadas.
- [ ] Color pickers funcionam para texto, shapes e backgrounds.
- [ ] Sem elemento selecionado, exibe propriedades do slide.

---

### Story 4.5 - Painel de Layers (Z-Index)

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar o painel de layers para controlar a ordem de profundidade (z-index) dos elementos no canvas.

**Tasks**:
1. Criar componente `<LayersPanel>` (tab ou setor dentro do painel esquerdo/direito).
2. Listar todos os elementos do slide ativo em ordem de z-index.
3. Nome do elemento (tipo + label, ex: "Texto: Titulo", "Imagem: foto1.png").
4. Icone de visibilidade (olho) para show/hide elementos.
5. Icone de lock para bloquear edicao de elementos.
6. Drag-and-drop para reordenar z-index.
7. Botoes: "Trazer para frente", "Enviar para tras", "Trazer ao topo", "Enviar ao fundo".
8. Click no layer seleciona o elemento no canvas.

**Criterios de Aceitacao**:
- [ ] Layers listados em ordem de z-index.
- [ ] Drag-and-drop reordena z-index.
- [ ] Visibilidade e lock funcionam.
- [ ] Click no layer seleciona elemento no canvas.
- [ ] Botoes de reordenacao funcionam.

---

### Story 4.6 - Smart Guides e Snap to Grid

**Prioridade**: P1
**Complexidade**: L
**Dependencias**: 4.1

**Descricao**: Implementar linhas de alinhamento inteligentes e snap to grid para posicionamento preciso de elementos.

**Tasks**:
1. Implementar deteccao de alinhamento com bordas e centros de outros elementos.
2. Renderizar linhas guia (vermelhas/azuis) quando um elemento se alinha com outro.
3. Snap magnetico: quando proximo de alinhamento, o elemento "gruda" na posicao.
4. Snap to grid configuuravel (grid de 10px, 20px, etc.).
5. Toggle para ativar/desativar smart guides.
6. Toggle para ativar/desativar snap to grid.
7. Deteccao de alinhamento com centros horizontais e verticais do canvas.

**Criterios de Aceitacao**:
- [ ] Linhas guia aparecem ao arrastar elementos proximo a alinhamentos.
- [ ] Snap magnetico funciona (elemento "gruda" no alinhamento).
- [ ] Alinhamento detectado com bordas, centros de outros elementos e centro do canvas.
- [ ] Toggles para ativar/desativar.

---

### Story 4.7 - Mascaras de Imagem

**Prioridade**: P2
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar clip de imagem com shapes (circulo, estrela, etc.) usando funcionalidades de masking do Konva.

**Tasks**:
1. Adicionar opcao "Aplicar mascara" nas propriedades de imagem.
2. Picker de shapes de mascara (circulo, estrela, triangulo, hexagono, custom).
3. Implementar clip via Konva `clipFunc` ou Group com clip.
4. Preview em tempo real da mascara aplicada.
5. Opcao de remover mascara.

**Criterios de Aceitacao**:
- [ ] Imagem pode ser clipada com shapes predefinidos.
- [ ] Preview em tempo real da mascara.
- [ ] Mascara pode ser removida.

---

### Story 4.8 - Undo/Redo

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar sistema de undo/redo usando Zustand middleware, com historico de estados do canvas.

**Tasks**:
1. Criar middleware Zustand para undo/redo (`temporal` ou custom).
2. Capturar snapshot do estado a cada acao significativa (adicionar, mover, editar, deletar elemento).
3. Limitar historico (ex: ultimos 50 estados).
4. Implementar `undo()` e `redo()` no store.
5. Atalhos de teclado: Ctrl+Z (undo), Ctrl+Shift+Z (redo).
6. Botoes na toolbar com estado disabled quando nao ha acoes para desfazer/refazer.
7. Resetar historico ao trocar de slide.

**Criterios de Aceitacao**:
- [ ] Undo reverte a ultima acao.
- [ ] Redo reaplica a ultima acao desfeita.
- [ ] Atalhos de teclado funcionam.
- [ ] Historico limitado a 50 estados.
- [ ] Botoes na toolbar refletem estado (disabled quando vazio).

---

### Story 4.9 - Funcionalidades Adicionais do Editor

**Prioridade**: P1
**Complexidade**: L
**Dependencias**: 4.1, 4.4

**Descricao**: Implementar funcionalidades complementares do editor: agrupamento, copiar/colar entre slides, aplicar Brand Kit, locking.

**Tasks**:
1. **Agrupamento**: selecionar multiplos elementos (Shift+click ou arraste de selecao) e agrupa-los.
2. Grupo move/redimensiona como unidade.
3. Desagrupar.
4. **Copiar/colar entre slides**: Ctrl+C copia elemento(s), Ctrl+V cola no slide ativo.
5. Funcionar entre slides diferentes.
6. **Aplicar Brand Kit**: botao que aplica cores e fontes do Brand Kit ativo a todos os elementos do carrossel.
7. **Locking**: campo `editing_by` + timestamp no carrossel para evitar edicao concorrente por outro membro do workspace.
8. **Delete**: tecla Delete/Backspace remove elemento selecionado.
9. **Atalhos de teclado**: documentar e implementar atalhos comuns.

**Criterios de Aceitacao**:
- [ ] Agrupamento e desagrupamento funcionam.
- [ ] Copiar/colar entre slides funciona.
- [ ] Aplicar Brand Kit atualiza cores e fontes de todos os elementos.
- [ ] Locking previne edicao concorrente.
- [ ] Delete remove elemento selecionado.

---

### Story 4.10 - Suporte a Video/GIF

**Prioridade**: P2
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar suporte a video e GIF em slides usando Konva Image com video source.

**Tasks**:
1. Opcao de inserir video/GIF na toolbar (upload ou URL).
2. Renderizar video/GIF via Konva `Image` com video element como source.
3. Controles de playback no painel de propriedades (play, pause, loop).
4. Preview com primeiro frame quando pausado.
5. Limitacoes claras na UI (video nao exporta para PNG estaatico, apenas primeiro frame).

**Criterios de Aceitacao**:
- [ ] Video/GIF pode ser inserido no canvas.
- [ ] Playback funciona no editor.
- [ ] Exportacao PNG usa primeiro frame do video.

---

### Story 4.11 - Salvar Carrossel e Auto-Save

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 4.1

**Descricao**: Implementar salvamento do carrossel (manual e automatico), serializando o estado do Konva para `canvas_json`.

**Tasks**:
1. Botao "Salvar" na toolbar.
2. Serializar estado de cada slide para `canvas_json` (jsonb).
3. Validar `canvas_json` com schema Zod (limite 5MB, rejeitar URLs com protocolos nao-HTTPS).
4. Salvar em `carousel_slides` via TanStack Query mutation.
5. Auto-save com debounce (a cada 30s de inatividade ou apos cada acao).
6. Indicador visual de status de salvamento ("Salvo", "Salvando...", "Nao salvo").
7. Gerar thumbnail de baixa resolucao de cada slide apos salvar.
8. Atualizar `carousels.updated_at` e incrementar `version`.

**Criterios de Aceitacao**:
- [ ] Salvamento manual funciona.
- [ ] Auto-save executa apos 30s de inatividade.
- [ ] `canvas_json` validado com Zod antes de salvar.
- [ ] Indicador de status de salvamento visivel.
- [ ] Thumbnails gerados apos salvar.

---

## Fase 5 - Exportacao & Publicacao

**Objetivo**: Exportar carrosseis como PNG e publicar/agendar no Instagram.

**Dependencias**: Fase 4 (editor).

**Complexidade geral**: Media-Alta.

---

### Story 5.1 - Exportacao PNG Client-Side

**Prioridade**: P0
**Complexidade**: M
**Dependencias**: 4.11

**Descricao**: Implementar exportacao de slides como PNG de alta qualidade (1080x1350) usando Konva client-side, com upload para Supabase Storage.

**Tasks**:
1. Criar canvas offscreen Konva com dimensoes exatas 1080x1350.
2. Renderizar slide no canvas offscreen (carregar fontes antes via FontFace API).
3. `stage.toDataURL({ pixelRatio: 2 })` ou `stage.toBlob()` para gerar PNG de alta qualidade.
4. Upload do PNG para Supabase Storage (bucket `exports`, privado, signed URLs).
5. Salvar URL em `carousel_slides.export_url`.
6. Botao "Exportar Slide" para slide individual.
7. Botao "Exportar Todos" para todos os slides sequencialmente.
8. Progress bar durante exportacao.
9. Garantir idempotencia: mesmo input = mesmo output.

**Criterios de Aceitacao**:
- [ ] PNG exportado em 1080x1350 com qualidade alta.
- [ ] Fontes customizadas renderizam corretamente no PNG.
- [ ] PNG salvo no Supabase Storage com signed URL.
- [ ] URL salva em `carousel_slides.export_url`.
- [ ] Exportacao de todos os slides com progress bar.
- [ ] Exportacao idempotente.

---

### Story 5.2 - Download em Lote (ZIP)

**Prioridade**: P0
**Complexidade**: S
**Dependencias**: 5.1

**Descricao**: Implementar download em lote de todos os slides como arquivo ZIP.

**Tasks**:
1. Instalar `jszip` e `file-saver`.
2. Exportar todos os slides (se nao exportados ainda, exportar primeiro).
3. Baixar PNGs do Storage.
4. Criar ZIP com JSZip (nomes: `slide-01.png`, `slide-02.png`, etc.).
5. Trigger download do ZIP.
6. Progress bar durante processo.

**Criterios de Aceitacao**:
- [ ] ZIP gerado com todos os slides PNG.
- [ ] Nomes de arquivo sequenciais.
- [ ] Download automatico do ZIP.
- [ ] Progress bar visivel.

---

### Story 5.3 - Publicacao no Instagram via Meta API

**Prioridade**: P1
**Complexidade**: XL
**Dependencias**: 1.9, 5.1

**Descricao**: Implementar publicacao de carrosseis no Instagram usando Meta Content Publishing API.

**Tasks**:
1. Verificar se o workspace tem `meta_connections` ativa e token valido.
2. Se token expirado, implementar renovacao automatica via Edge Function.
3. Criar Edge Function `schedule-post/index.ts`.
4. Fluxo de publicacao:
   a. Upload de cada PNG como media object na Meta API.
   b. Criar carousel container com IDs dos media objects.
   c. Publicar carousel container.
5. Botao "Publicar no Instagram" no editor/dashboard.
6. Confirm dialog com preview antes de publicar.
7. Status tracking: publishing -> published/failed.
8. Salvar `meta_post_id` no carrossel apos publicacao.
9. Tratamento de erros da Meta API com mensagens claras.
10. Validar limites da API (max 10 slides por carousel, aspect ratio).

**Criterios de Aceitacao**:
- [ ] Carrossel publicado no Instagram com todos os slides.
- [ ] Token renovado automaticamente se expirado.
- [ ] Status tracking (publishing, published, failed).
- [ ] Erros da Meta API exibidos com mensagens claras.
- [ ] `meta_post_id` salvo apos publicacao.

---

### Story 5.4 - Agendamento de Publicacao

**Prioridade**: P1
**Complexidade**: L
**Dependencias**: 5.3

**Descricao**: Implementar agendamento de publicacao no Instagram com date/time picker e execucao via pg_cron + pg_net.

**Tasks**:
1. Adicionar botao "Agendar" ao lado de "Publicar".
2. Date/time picker para selecionar data e hora de publicacao.
3. Salvar em `scheduled_posts` com `status = 'pending'`.
4. Atualizar `carousels.status = 'scheduled'` e `carousels.scheduled_at`.
5. Configurar pg_cron job que verifica `scheduled_posts` pendentes a cada minuto.
6. Quando chega a hora, pg_net invoca Edge Function `schedule-post` via HTTP.
7. Atualizar status para `publishing` -> `published` ou `failed`.
8. Listar posts agendados no dashboard.
9. Opcao de cancelar agendamento.
10. Notificacao (toast) quando post e publicado com sucesso.

**Criterios de Aceitacao**:
- [ ] Usuario pode agendar publicacao para data/hora futura.
- [ ] pg_cron verifica e executa posts agendados.
- [ ] Status atualizado corretamente em cada etapa.
- [ ] Agendamento pode ser cancelado.
- [ ] Lista de posts agendados visivel no dashboard.

---

### Story 5.5 - Edge Function webhook-meta

**Prioridade**: P2
**Complexidade**: M
**Dependencias**: 5.3

**Descricao**: Criar Edge Function para receber webhooks da Meta API e atualizar status de publicacoes.

**Tasks**:
1. Criar `supabase/functions/webhook-meta/index.ts`.
2. Validar assinatura do webhook (App Secret).
3. Processar eventos de publicacao (sucesso, falha).
4. Atualizar status em `scheduled_posts` e `carousels`.
5. Responder com 200 OK para acknowledging.

**Criterios de Aceitacao**:
- [ ] Webhook recebido e validado (assinatura verificada).
- [ ] Status atualizado no banco apos evento.
- [ ] Resposta 200 OK para Meta API.

---

## Fase 6 - Polish

**Objetivo**: Funcionalidades secundarias e refinamento.

**Dependencias**: Fases 1-5.

**Complexidade geral**: Media.

---

### Story 6.1 - Versionamento de Carrosseis

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 4.11

**Descricao**: Implementar historico de versoes do carrossel com opcao de visualizar e restaurar versoes anteriores.

**Tasks**:
1. A cada salvamento significativo ou ao sair do editor, criar entry em `carousel_versions`.
2. Snapshot completo: `snapshot_json` com `canvas_json` de todos os slides.
3. Registrar `version` (incremento), `created_at` e `created_by`.
4. Criar painel de historico de versoes (sidebar ou modal).
5. Listar versoes com data, autor e numero da versao.
6. Preview de versao anterior (renderizar snapshot em mini canvas).
7. Botao "Restaurar esta versao" com confirmacao.
8. Restaurar: substituir slides atuais pelo snapshot da versao selecionada.

**Criterios de Aceitacao**:
- [ ] Versoes criadas automaticamente ao salvar.
- [ ] Historico de versoes visivel com data e autor.
- [ ] Preview de versao anterior funciona.
- [ ] Restauracao de versao anterior funciona sem perda de dados.

---

### Story 6.2 - Salvar Template Customizado

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 4.11, 2.3

**Descricao**: Permitir que o usuario salve um carrossel editado como template customizado do workspace.

**Tasks**:
1. Botao "Salvar como Template" no editor.
2. Dialog com campos: nome do template, categoria.
3. Extrair layout de cada slide como `layout_json` (substituir conteudo por placeholders).
4. Criar registro em `templates` com `workspace_id` do workspace ativo.
5. Criar registros em `template_slide_variants` para cada slide.
6. Gerar thumbnail do template.
7. Template customizado aparece na listagem de templates do workspace.

**Criterios de Aceitacao**:
- [ ] Carrossel pode ser salvo como template.
- [ ] Conteudo substituido por placeholders no layout.
- [ ] Template aparece na listagem do workspace.
- [ ] Template pode ser usado para gerar novos carrosseis.

---

### Story 6.3 - QR Code Generator

**Prioridade**: P2
**Complexidade**: S
**Dependencias**: 4.3

**Descricao**: Implementar geracao de QR Code a partir de URL para insercao no canvas.

**Tasks**:
1. Instalar biblioteca de QR Code (ex: `qrcode`).
2. Modal com input de URL na toolbar.
3. Gerar QR Code como imagem/canvas.
4. Inserir no canvas como elemento Image do Konva.
5. QR Code editavel como qualquer outro elemento (mover, redimensionar).
6. Opcoes de cor e tamanho no painel de propriedades.

**Criterios de Aceitacao**:
- [ ] QR Code gerado a partir de URL.
- [ ] Inserido no canvas como elemento editavel.
- [ ] Cor e tamanho editaveis.

---

### Story 6.4 - Graficos (Mini Chart Component)

**Prioridade**: P3
**Complexidade**: M
**Dependencias**: 4.3

**Descricao**: Implementar componente de mini graficos para slides de estatistica.

**Tasks**:
1. Selecionar biblioteca leve de graficos (ex: recharts, chart.js ou custom SVG).
2. Tipos de grafico: barras, pizza, linhas.
3. Modal de configuracao: dados (input manual), cores, labels.
4. Renderizar grafico como imagem e inserir no canvas Konva.
5. Opcao de editar dados do grafico (reabrir modal).

**Criterios de Aceitacao**:
- [ ] Graficos de barras, pizza e linhas podem ser criados.
- [ ] Dados configurados pelo usuario via modal.
- [ ] Grafico inserido no canvas como imagem editavel.
- [ ] Dados podem ser editados apos insercao.

---

### Story 6.5 - Dashboard Principal

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 1.8, 4.11

**Descricao**: Implementar o dashboard principal com listagem de carrosseis, filtros, busca e acoes rapidas.

**Tasks**:
1. Criar pagina `/dashboard` como pagina inicial apos login.
2. Grid de carrosseis do workspace com thumbnails.
3. Filtros por status (draft, ready, scheduled, published).
4. Busca por titulo.
5. Ordenacao por data (mais recente primeiro).
6. Acoes rapidas por carrossel: editar, duplicar, exportar, publicar, deletar.
7. Botao "Novo Carrossel" -> redirecionar para `/create`.
8. Cards com informacoes: titulo, status, data de criacao, numero de slides.
9. Paginacao ou infinite scroll.

**Criterios de Aceitacao**:
- [ ] Carrosseis do workspace listados com thumbnails.
- [ ] Filtros e busca funcionam.
- [ ] Acoes rapidas acessiveis.
- [ ] Paginacao funciona.

---

### Story 6.6 - Pagina de Configuracoes Unificada

**Prioridade**: P1
**Complexidade**: M
**Dependencias**: 1.8, 2.1, 3.1

**Descricao**: Implementar pagina de configuracoes com tabs para todas as configuracoes do workspace.

**Tasks**:
1. Criar pagina `/settings` com tabs.
2. Tab **Geral**: nome do workspace, slug, dominio customizado.
3. Tab **White-Label**: logo, favicon, cores (reutilizar componentes do Wizard).
4. Tab **Brand Kits**: listagem e CRUD (reutilizar Story 2.1).
5. Tab **IA**: configuracao de provider e API keys (reutilizar Story 3.1).
6. Tab **Instagram**: status da conexao, reconectar, desconectar.
7. Tab **Membros**: gerenciamento de membros (reutilizar Story 1.8).
8. Tab **Fontes**: listagem e upload de fontes customizadas.
9. Restringir acesso por role (apenas owner e admin acessam configuracoes).

**Criterios de Aceitacao**:
- [ ] Todas as configuracoes acessiveis em tabs.
- [ ] Mudancas salvas com feedback visual.
- [ ] Acesso restrito a owner e admin.

---

## Resumo do Epico

| Fase | Stories | Prioridade Geral | Complexidade Total |
|------|---------|-------------------|--------------------|
| Fase 1 - Fundacao & Wizard | 10 stories (1.1 a 1.10) | P0-P1 | XL |
| Fase 2 - Brand Kit & Templates | 4 stories (2.1 a 2.4) | P0-P1 | L-XL |
| Fase 3 - Inteligencia Artificial | 6 stories (3.1 a 3.6) | P0-P1 | L-XL |
| Fase 4 - Editor Visual | 11 stories (4.1 a 4.11) | P0-P2 | XL |
| Fase 5 - Exportacao & Publicacao | 5 stories (5.1 a 5.5) | P0-P2 | L-XL |
| Fase 6 - Polish | 6 stories (6.1 a 6.6) | P1-P3 | M |
| **Total** | **42 stories** | | |

## Mapa de Dependencias Completo

```
1.1 (Monorepo)
 |
 +-> 1.2 (SQL Migrations) -> 1.3 (Edge Bootstrap)
 |                                |
 +-> 1.4 (Client Dinamico) ------+-> 1.5 (Wizard Step 1)
 |                                |
 +-> 1.6 (Auth) -----------------+-> 1.7 (Wizard Steps 2-3) -> 1.8 (Multi-Tenancy)
                                                                    |
                                              +---------------------+---------------------+
                                              |                     |                     |
                                              v                     v                     v
                                         1.9 (Wizard 5-6)     2.1 (Brand Kit)       2.3 (Templates)
                                              |                     |                     |
                                              v                     v                     v
                                         1.10 (Wizard 7)      2.2 (Fontes)          2.4 (Templates Seed)
                                              |                     |                     |
                                              +---------------------+---------------------+
                                              |
                                              v
                                    3.1 (Config IA) -> 3.2 (Edge generate-content)
                                         |                     |
                                         +-> 3.3 (Edge transcribe)
                                         |                     |
                                         +-> 3.4 (Edge generate-image)
                                                               |
                                              +----------------+
                                              |
                                              v
                                         3.5 (Geracao Frontend) -> 3.6 (Preview)
                                                                      |
                                              +-----------------------+
                                              |
                                              v
                                         4.1 (Editor Base)
                                              |
                        +--------+--------+--------+--------+--------+
                        |        |        |        |        |        |
                        v        v        v        v        v        v
                   4.2(Slides) 4.3(Tool) 4.4(Props) 4.5(Layers) 4.6(Guides) 4.8(Undo)
                        |        |        |        |
                        +--------+--------+--------+-> 4.9 (Extras)
                                 |
                                 +-> 4.7 (Mascaras)
                                 +-> 4.10 (Video/GIF)
                                              |
                                              v
                                         4.11 (Salvar)
                                              |
                        +---------------------+---------------------+
                        |                     |                     |
                        v                     v                     v
                   5.1 (Export PNG)      6.1 (Versionamento)   6.5 (Dashboard)
                        |
                        +-> 5.2 (ZIP)
                        |
                        +-> 5.3 (Meta Publicacao) -> 5.4 (Agendamento)
                                  |
                                  +-> 5.5 (Webhook Meta)
                        
                   6.2 (Template Custom)  6.3 (QR Code)  6.4 (Graficos)  6.6 (Configuracoes)
```

## Prioridades

| Prioridade | Descricao | Stories |
|-----------|-----------|---------|
| **P0** | Bloqueante - sem isso a plataforma nao funciona | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.3, 2.4, 3.2, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.8, 4.11, 5.1, 5.2 |
| **P1** | Importante - necessario para o produto ser util | 1.9, 1.10, 2.2, 3.1, 3.3, 3.4, 4.5, 4.6, 4.9, 5.3, 5.4, 6.1, 6.2, 6.5, 6.6 |
| **P2** | Desejavel - melhora a experiencia | 4.7, 4.10, 5.5, 6.3 |
| **P3** | Nice to have - pode ser adicionado depois | 6.4 |
