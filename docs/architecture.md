# Content Hub - Descricao Completa do Projeto

## Sumario

1. [Visao Geral do Produto](#1-visao-geral-do-produto)
2. [Arquitetura Tecnica](#2-arquitetura-tecnica)
3. [Funcionalidades Core](#3-funcionalidades-core)
4. [Modelo de Dados](#4-modelo-de-dados)
5. [Seguranca](#5-seguranca)
6. [Fases de Implementacao](#6-fases-de-implementacao)
7. [Diferenciais Tecnicos](#7-diferenciais-tecnicos)

---

## 1. Visao Geral do Produto

### O que e o Content Hub

Content Hub e uma plataforma SaaS white-label de criacao de carrosseis para Instagram, alimentada por inteligencia artificial. A plataforma permite que empreendedores nao tecnicos adquiram uma licenca, apliquem sua propria marca (logo, cores, dominio customizado) e oferecam uma ferramenta completa de geracao de carrosseis para seus proprios clientes ou para uso proprio.

O produto gera carrosseis automaticamente a partir de diversas fontes de conteudo: prompts textuais, URLs de blog, transcricoes de video do YouTube, links de Reels do Instagram e threads do Twitter/X. O resultado final e comparavel ou superior ao trabalho de um designer humano, entregue em segundos.

### Problema que Resolve

Criar carrosseis de qualidade para Instagram e um processo que consome tempo e exige habilidades de design. Empreendedores digitais, agencias de marketing e criadores de conteudo enfrentam tres dores principais:

1. **Custo alto de design**: contratar designers ou usar ferramentas complexas como Canva/Figma demanda tempo e investimento.
2. **Falta de consistencia visual**: sem um Brand Kit centralizado, os carrosseis perdem identidade visual ao longo do tempo.
3. **Barreira tecnica**: ferramentas existentes exigem conhecimento de design que a maioria dos empreendedores nao possui.
4. **Ausencia de automacao end-to-end**: o fluxo tipico (criar conteudo, design, exportar, agendar, publicar) envolve multiplas ferramentas desconectadas.

### Proposta de Valor Unica

O Content Hub se diferencia em quatro eixos:

- **White-label completo**: a marca "Content Hub" ou "Agentise" nunca aparece na interface. O cliente final ve apenas a marca do empreendedor que licenciou a plataforma. Logo, favicon, cores e dominio sao totalmente customizaveis.
- **Zero backend proprio**: toda a infraestrutura roda no Supabase do proprio cliente. O frontend e um SPA estatico deployado na Vercel. Isso elimina custos de servidor, simplifica compliance e da ao cliente total controle sobre seus dados.
- **IA multi-provider**: o usuario escolhe qual provedor de LLM usar (OpenAI, Anthropic, Google, Groq, etc.) e insere sua propria API key. Isso evita vendor lock-in e permite ao cliente controlar seus custos de IA.
- **Fluxo end-to-end**: da geracao de conteudo por IA ate a publicacao agendada no Instagram, tudo acontece dentro de uma unica plataforma.

### Publico-Alvo Detalhado

O publico-alvo principal sao **empreendedores nao tecnicos** que desejam ter sua propria ferramenta de carrosseis com marca propria. Isso inclui:

| Perfil | Caso de Uso |
|--------|------------|
| **Infoprodutores** | Criar carrosseis educativos para lancamentos e conteudo evergreen |
| **Agencias de social media** | Oferecer como ferramenta interna para producao em escala |
| **Consultores de marketing** | Revender como servico adicional para clientes |
| **SaaS builders** | Integrar como modulo de conteudo visual em plataformas existentes |
| **Criadores de conteudo** | Automatizar a producao de carrosseis a partir de videos e artigos |

Todos compartilham a caracteristica de nao serem desenvolvedores, o que exige que o onboarding (Wizard) seja guiado e que a interface seja intuitiva.

### Modelo de Negocio

O modelo e **white-label com licenciamento**:

- A **Agentise** desenvolve e mantem a plataforma.
- O **cliente licenciado** (empreendedor) deploya o frontend na sua Vercel, configura seu Supabase, aplica sua marca e opera de forma independente.
- **Nao ha billing interno** na plataforma. O controle comercial (cobranca de usuarios finais, assinaturas, etc.) e externo e de responsabilidade do cliente licenciado.
- O cliente licenciado arca com os custos de Supabase, Vercel e API keys de IA, tendo total transparencia e controle sobre seus gastos.

---

## 2. Arquitetura Tecnica

### Stack Completa

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui | React pela maturidade do ecossistema; Vite pela velocidade de build; TypeScript para type safety; Tailwind para estilizacao rapida e consistente; shadcn/ui para componentes acessiveis e customizaveis sem vendor lock-in (codigo copiado, nao dependencia) |
| **Canvas/Editor** | Konva.js (react-konva) | Biblioteca canvas 2D performante com suporte nativo a layers, drag-and-drop, z-index, transformacoes, mascaras e exportacao para imagem. Ideal para editores visuais complexos |
| **Backend** | Supabase Cloud (do cliente) | Database (Postgres), Auth, Edge Functions, Realtime, Storage, pg_cron. Elimina necessidade de backend proprio; o cliente tem total controle dos dados |
| **Storage** | Supabase Storage (do cliente) | Imagens, fontes, assets e exports armazenados no bucket do cliente. Signed URLs para acesso seguro |
| **Auth** | Supabase Auth (do cliente) | Email/senha. Sistema maduro com JWT, RLS integration nativa, e zero configuracao adicional |
| **Deploy** | Vercel | Deploy de SPA estatico; dominio customizado por cliente; CDN global; headers de seguranca via vercel.json |
| **Exportacao** | Client-side via Konva.js | `stage.toDataURL()` / `stage.toBlob()` em canvas offscreen 1080x1350. Elimina necessidade de Puppeteer server-side. Fontes ja carregadas no browser via FontFace API |
| **Filas/Jobs** | pg_cron + pg_net | pg_cron agenda execucoes SQL; pg_net (extensao HTTP do Postgres) invoca Edge Functions via HTTP. Combinacao permite agendamento nativo sem infraestrutura adicional |
| **Transcricao** | Supadata API / Whisper API | Supadata para YouTube (rapido e barato); Whisper como fallback para Reels e videos diretos |
| **Geracao de imagens** | Gemini Imagen (Google AI) | Geracao de imagens por IA diretamente no editor; usuario insere propria API key |
| **LLM** | Multi-provider (OpenAI, Anthropic, Google, Groq) | Adapter pattern permite adicionar novos providers sem alterar codigo existente |
| **Icones** | Lucide React | Biblioteca open-source com 1000+ icones consistentes; tree-shakeable |
| **Estado global** | Zustand | Leve, sem boilerplate, com middleware para undo/redo |
| **Formularios** | React Hook Form + Zod | Performance (uncontrolled inputs) + validacao type-safe |
| **Queries** | TanStack Query (React Query) | Cache, retry, invalidation, optimistic updates para chamadas Supabase |
| **Monorepo** | pnpm workspaces | Resolucao eficiente de packages, workspace protocol, disk-space efficient |

### Diagrama da Arquitetura

```
+------------------------------------------------------------------+
|                        CLIENTE BROWSER                            |
|                                                                   |
|  +--------------------+  +-------------------+  +---------------+ |
|  |  React SPA (Vite)  |  | Konva.js Editor   |  |  Zustand      | |
|  |  + shadcn/ui       |  | (Canvas 2D)       |  |  Stores       | |
|  |  + Tailwind        |  |                   |  |               | |
|  +--------+-----------+  +--------+----------+  +-------+-------+ |
|           |                       |                      |         |
|           +----------+------------+----------------------+         |
|                      |                                             |
|              +-------v--------+                                    |
|              | Supabase Client|    (criado dinamicamente           |
|              | (Anon Key)     |     a partir do localStorage)      |
|              +-------+--------+                                    |
+---------------------|---------------------------------------------|+
                      |                                              
          +-----------v-----------+                                   
          |       INTERNET        |                                   
          +-----------+-----------+                                   
                      |                                              
+---------------------|---------------------------------------------+
|              SUPABASE DO CLIENTE                                   |
|                      |                                             |
|  +-------------------v-------------------+                         |
|  |           Supabase Gateway            |                         |
|  |  (Auth JWT + RLS enforcement)         |                         |
|  +---+--------+--------+--------+-------+                         |
|      |        |        |        |                                  |
|  +---v---+ +--v--+ +--v---+ +--v-----------+                      |
|  |Postgres| |Auth | |Stor- | |Edge Functions|                      |
|  |  + RLS | |     | |age   | |  (Deno)      |                      |
|  |  + Vault|      | |      | |              |                      |
|  +---+---+ +-----+ +------+ +--+-+-+-+-----+                      |
|      |                          | | | |                            |
|      |  +--------+---------+----+ | | +----+                       |
|      |  |        |         |      | |      |                       |
|  +---v--v-+ +----v----+ +-v------v-v+ +---v--------+              |
|  |pg_cron | |bootstrap| |generate-  | |meta-oauth  |              |
|  |pg_net  | |         | |content    | |schedule-post|              |
|  +--------+ +---------+ |generate-  | |transcribe  |              |
|                          |image     | |webhook-meta|              |
|                          +----+-----+ +---+--------+              |
+-------------------------------|-----------|------------------------+
                                |           |                        
                    +-----------v-----------v---------+              
                    |      PROVIDERS EXTERNOS          |              
                    |  OpenAI | Anthropic | Google     |              
                    |  Groq   | Supadata  | Meta API   |              
                    +-----------------------------------------+              
```

### Fluxo de Dados entre Componentes

1. **Bootstrap**: Browser carrega SPA -> verifica localStorage -> se vazio, exibe Wizard -> usuario insere Supabase URL + Anon Key -> frontend valida conexao -> chama Edge Function `bootstrap` para executar migrations.

2. **Autenticacao**: Supabase Auth do cliente emite JWT -> todas as queries usam esse JWT -> RLS filtra dados por workspace automaticamente.

3. **Geracao de conteudo**: Frontend envia request a Edge Function `generate-content` -> Edge Function busca API key do banco (descriptografa via Vault) -> chama LLM provider -> retorna JSON estruturado -> frontend valida com Zod -> aplica nos templates.

4. **Exportacao**: Editor Konva renderiza slide em canvas offscreen (1080x1350) -> `stage.toBlob()` -> upload para Supabase Storage -> URL salva em `carousel_slides.export_url`.

5. **Publicacao Instagram**: Edge Function `schedule-post` busca PNGs do Storage -> upload como media objects na Meta API -> cria carousel container -> publica. Para agendamento, pg_cron + pg_net invocam a Edge Function na hora programada.

### Modelo "Zero Backend Proprio"

O Content Hub opera sem nenhum servidor proprio. O frontend e um SPA estatico (HTML, CSS, JS) deployado na Vercel. Toda a logica server-side roda nas Edge Functions do Supabase do cliente. Isso significa:

- **Sem custos de servidor**: o empreendedor paga apenas Supabase (plano gratuito cobre muitos casos) e Vercel (plano gratuito para SPAs).
- **Total controle dos dados**: todos os dados residem no Supabase do cliente. A Agentise nao tem acesso.
- **Compliance simplificado**: o cliente sabe exatamente onde seus dados estao e pode aplicar suas proprias politicas.
- **Escalabilidade delegada**: Supabase escala automaticamente. Nao ha servidor para gerenciar.

A unica pre-condicao e que o cliente deploye as Edge Functions no seu Supabase antes de iniciar o Wizard (facilitado pelo script `npx content-hub deploy-functions`).

### Edge Functions como Barreira de Seguranca

As Edge Functions (Deno runtime) atuam como proxy seguro entre o frontend e todos os servicos externos. Elas:

1. **Validam o JWT** do usuario autenticado.
2. **Verificam pertencimento ao workspace** via tabela `workspace_members`.
3. **Descriptografam API keys** server-side usando Supabase Vault (pgsodium).
4. **Implementam rate limiting** por workspace.
5. **Sanitizam inputs e validam outputs** antes de retornar ao frontend.

Isso garante que API keys de LLM, tokens OAuth do Meta e credenciais de transcricao **nunca trafeguem pelo browser**.

---

## 3. Funcionalidades Core

### 3.1 Wizard de Onboarding (7 Steps)

O Wizard guia o usuario pelo setup completo da plataforma. Cada step salva progresso no banco (campo `setup_step` em `platform_config`), permitindo retomar de onde parou.

#### Step 1 - Conectar Supabase

- Usuario insere Supabase URL e Anon Key (Service Role Key nunca e inserida no browser).
- Frontend valida a conexao com `SELECT 1` via anon key.
- Validacao de formato: URL deve seguir padrao `https://*.supabase.co`; API keys validadas por tamanho e charset.
- Chama Edge Function `bootstrap` para executar migrations SQL server-side.
- A Edge Function usa `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (env var nativa, nunca exposta).
- Migrations sao 100% estaticas (strings SQL bundled no frontend), sem interpolacao de input.
- Cada migration e envolta em transaction e registrada em `schema_versions`.
- Credenciais salvas em localStorage (apenas URL e anon key).

**Pre-requisito**: o cliente deve deployar as Edge Functions antes do Wizard (`npx content-hub deploy-functions`).

#### Step 2 - Criar Workspace

- Nome e slug do workspace.
- Slug deve ser unico (validacao em tempo real).
- Cria registro na tabela `workspaces` e `workspace_members` (usuario como owner).

#### Step 3 - White-Label

- Upload de logo e favicon.
- Definicao de cores primaria e secundaria (color picker).
- Configuracao de dominio customizado (opcional).
- Preview em tempo real das cores aplicadas na interface.

#### Step 4 - Brand Kit

- Upload de logo para carrosseis (diferente do logo da plataforma).
- Definicao de paleta de cores: primary, secondary, accent, background, text.
- Escolha ou import de fontes (heading e body).
- Upload de avatar.
- Definicao do tom de voz para IA (instrucao textual: "fale de forma descontraida, use emojis").

#### Step 5 - Configurar IA

- Escolha do LLM provider (dropdown: OpenAI, Anthropic, Google, Groq).
- Insercao da API key do LLM.
- Insercao da API key do Gemini Imagen (geracao de imagens).
- Insercao da API key da Supadata (transcricao de videos).
- Todas as keys armazenadas encrypted via Supabase Vault.

#### Step 6 - Conectar Instagram

- Insercao do Meta App ID e App Secret.
- Inicio do fluxo OAuth com parametro `state` (CSRF protection).
- Token exchange feito server-side via Edge Function `meta-oauth` (App Secret nunca exposto no browser).
- Validacao de `redirect_uri` contra whitelist de dominios autorizados.
- Selecao de pagina do Facebook e perfil Instagram vinculado.
- Access token armazenado encrypted via Vault.

#### Step 7 - Gerar Primeiro Carrossel

- Input de tema ou URL.
- Geracao via IA como demonstracao.
- Preview dos slides gerados.
- Opcao de aceitar (ir para editor), rejeitar (regenerar) ou editar prompt.
- Serve como validacao de que todo o setup funciona corretamente.

### 3.2 Geracao de Carrossel por IA

O fluxo completo de geracao e o seguinte:

1. **Escolha da fonte de conteudo**: texto livre, URL de blog, link YouTube, link Reels, link Twitter/X thread.

2. **Extracao automatica** (se URL de video): sistema chama Edge Function `transcribe`, que usa Supadata API (YouTube) ou Whisper API (Reels/videos diretos) para extrair a transcricao.

3. **Configuracao do carrossel**: tema, tom de voz (padrao do Brand Kit ou customizado), publico-alvo, quantidade de slides.

4. **Selecao de template**: categoria (educacional, vendas, storytelling, antes/depois, lista, CTA).

5. **Geracao server-side**: frontend envia request a Edge Function `generate-content`, que:
   - Busca API key do LLM no banco (descriptografa via Vault).
   - Monta prompt com conteudo, tom de voz, categoria e estrutura do template.
   - Usa delimitadores claros (`<user_content>...</user_content>`) para prevenir prompt injection.
   - Chama o LLM provider server-side.
   - Retorna JSON estruturado.

6. **Validacao**: output do LLM e parseado e validado com schema Zod rigoroso. Formato esperado:
   ```json
   {
     "slides": [
       {
         "position": 1,
         "type": "capa",
         "headline": "...",
         "body": "...",
         "cta": "...",
         "notes": "..."
       }
     ]
   }
   ```

7. **Aplicacao no template**: conteudo textual e inserido nos placeholders do template Konva.

8. **Preview**: todos os slides exibidos lado a lado para revisao.

9. **Decisao**: aceitar (ir para editor), rejeitar (regenerar com mesmo ou novo prompt), ou editar prompt manualmente.

### 3.3 Editor de Carrossel (Konva.js)

O editor e a peca central da plataforma. Layout em tres paineis:

#### Painel Esquerdo - Visao Geral dos Slides

- Thumbnails de todos os slides do carrossel.
- Reordenacao via drag-and-drop.
- Adicionar/remover slides.
- Click no thumbnail seleciona o slide para edicao no canvas principal.

#### Canvas Principal (Centro)

- Konva Stage com dimensoes virtuais 1080x1350 (formato 4:5 do Instagram).
- Escalado para caber na area visivel da tela.
- Elementos selecionaveis, moviveis e redimensionaveis.
- Texto editavel inline (double-click para editar).
- Smart guides e snap to grid para alinhamento preciso.
- Zoom in/out.

#### Painel Direito - Propriedades

- Propriedades do elemento selecionado: cor, fonte, tamanho, posicao (x, y), opacidade, rotacao, borda.
- Contextual: muda conforme o tipo de elemento selecionado (texto, imagem, shape, etc.).

#### Toolbar Superior

| Ferramenta | Descricao |
|-----------|-----------|
| Texto | Adicionar caixa de texto com fonte do Brand Kit |
| Imagem | Upload de imagem do dispositivo |
| Shape | Shapes SVG embutidos: circulo, quadrado, retangulo, estrela, seta, balao, linha, triangulo |
| Icone | Picker de icones Lucide (1000+ opcoes) |
| QR Code | Gerar QR code a partir de URL |
| Logo | Inserir logo do Brand Kit |
| Avatar | Inserir avatar do Brand Kit |
| Grafico | Mini chart component |
| IA Imagen | Gerar imagem por prompt via Gemini Imagen (proxiado pela Edge Function) |
| Undo/Redo | Historico de acoes (Zustand middleware) |
| Zoom | Controle de zoom do canvas |

#### Funcionalidades Avancadas

- **Layers com z-index**: painel de layers permite reordenar a profundidade dos elementos.
- **Smart guides**: linhas de alinhamento aparecem ao arrastar elementos proximo a bordas ou centros de outros elementos.
- **Mascaras de imagem**: clip de imagem com shapes (circulo, estrela, etc.).
- **Agrupamento**: selecionar multiplos elementos e agrupa-los para mover/redimensionar juntos.
- **Copiar/colar entre slides**: copiar elementos de um slide e colar em outro.
- **Video/GIF**: suporte a video e GIF em slides via Konva `Image` com video source.
- **Aplicar Brand Kit**: a qualquer momento, aplicar cores e fontes do Brand Kit a todos os elementos do carrossel.
- **Locking**: campo `editing_by` + timestamp no carrossel para evitar edicao concorrente. Futuro: CRDTs para colaboracao real-time.

### 3.4 Sistema de Templates

#### Templates do Sistema (5 categorias)

| Categoria | Descricao | Estilo |
|-----------|-----------|--------|
| Educacional | Slides clean com numeracao, headline + body | Limpo, estruturado |
| Vendas | CTA forte, cores vibrantes, urgencia | Bold, alto contraste |
| Storytelling | Visual imersivo, texto sobre imagem | Cinematico |
| Antes/Depois | Layout split side-by-side | Comparativo |
| Lista | Bullet points visuais com icones | Organizado |

#### Variacoes por Posicao de Slide

| Posicao | Quantidade de Variacoes | Exemplos |
|---------|------------------------|----------|
| Capa | 3 | Minimalista, Bold, Imagem Full |
| Conteudo | 5 | Texto-only, Texto+Imagem, Citacao, Estatistica, Bullet List |
| CTA | 2 | Clean, Urgencia |
| Transicao | 2 | Pergunta, Statement |

Cada variacao e armazenada como `layout_json` na tabela `template_slide_variants`, contendo a estrutura Konva serializada com posicoes de elementos e placeholders para conteudo.

Templates customizados podem ser salvos pelo usuario a partir de qualquer carrossel editado.

### 3.5 Exportacao

A exportacao e feita inteiramente no lado do cliente (client-side):

1. Canvas offscreen e criado com dimensoes exatas 1080x1350 pixels.
2. `stage.toDataURL({ pixelRatio: 2 })` ou `stage.toBlob()` gera o PNG de alta qualidade.
3. PNG e enviado para Supabase Storage.
4. URL salva em `carousel_slides.export_url`.
5. Para download em lote, JSZip gera um arquivo ZIP com todos os slides.

A exportacao e idempotente: mesmo input produz o mesmo output.

### 3.6 Publicacao no Instagram

- **Meta Content Publishing API** via Facebook Login OAuth.
- Fluxo OAuth seguro com parametro `state` (CSRF), token exchange server-side via Edge Function `meta-oauth`.
- Publicacao de carrossel: upload dos PNGs como media objects, criacao do carousel container, publicacao.
- **Agendamento nativo**: usuario escolhe data/hora, `scheduled_posts` registra o agendamento, pg_cron + pg_net invocam Edge Function `schedule-post` na hora programada.
- Renovacao automatica de tokens antes da expiracao via Edge Function + pg_cron.

### 3.7 White-Label e Multi-Tenancy

#### White-Label

- Logo da plataforma (navbar, login) customizavel.
- Favicon customizavel.
- Cores primaria e secundaria da interface via CSS variables dinamicas (`--brand-primary`, `--brand-secondary`).
- Dominio customizado (configurado na Vercel pelo cliente).
- A marca "Content Hub", "Agentise" ou qualquer marca fixa **nunca aparece** na interface.

**Resolucao de workspace**: no load da app, o hostname (`window.location.hostname`) e comparado com `workspaces.custom_domain`. Em ambiente de desenvolvimento (localhost), fallback para slug na URL.

**Sanitizacao de CSS variables**: cores sao validadas (formato hex/rgb) antes de serem injetadas para prevenir injecao de CSS malicioso.

#### Multi-Tenancy

- Um usuario pode pertencer a multiplos workspaces.
- Workspace switcher no navbar.
- Quatro roles com permissoes granulares:
  - **Owner**: acesso total, incluindo deletar workspace.
  - **Admin**: tudo exceto deletar workspace.
  - **Editor**: SELECT, INSERT, UPDATE em carousels e carousel_slides.
  - **Viewer**: apenas SELECT (leitura).
- RLS granular por role via helper SQL `get_user_role()`.
- Sem limite de membros ou carrosseis por workspace.
- Isolamento total de dados entre workspaces via RLS.

### 3.8 Versionamento

- A cada "salvar" significativo ou ao sair do editor, uma entry e criada em `carousel_versions`.
- Snapshot completo do `canvas_json` de todos os slides.
- Usuario pode visualizar historico de versoes e restaurar qualquer versao anterior.
- Versionamento e fundamental para permitir experimentacao sem risco de perder trabalho.

---

## 4. Modelo de Dados

### Diagrama de Relacionamentos

```
platform_config (singleton)
       |
       v
workspaces ----< workspace_members >---- auth.users
    |
    +----< brand_kits
    |
    +----< ai_configs
    |
    +----< templates ----< template_slide_variants
    |
    +----< carousels ----< carousel_slides
    |         |
    |         +----< carousel_versions
    |         |
    |         +----< scheduled_posts
    |
    +----< custom_fonts
    |
    +----< meta_connections
    |
    +----< schema_versions (controle de migrations)
```

### Tabelas Detalhadas

#### `platform_config` (singleton por instancia)

Armazena configuracao global da instancia. RLS bloqueia 100% do acesso via anon key. Acesso via funcao RPC `get_setup_status()` (SECURITY DEFINER).

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador unico |
| supabase_url | text NOT NULL | URL do Supabase |
| supabase_anon_key | text NOT NULL | Chave anonima do Supabase |
| meta_app_id | text | ID do app Meta |
| meta_app_secret | text | Secret do app Meta (encrypted via Vault) |
| setup_completed | boolean | Se o setup foi finalizado |
| setup_step | int | Step atual do Wizard (1-7) para retomada |

#### `workspaces`

Entidade central do multi-tenancy. Cada workspace e uma instancia white-label independente.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador unico |
| name | text | Nome do workspace |
| slug | text UNIQUE | Slug unico para URLs |
| custom_domain | text UNIQUE | Dominio white-label (com indice) |
| logo_url | text | URL do logo da plataforma |
| favicon_url | text | URL do favicon |
| brand_primary_color | text | Cor primaria da interface |
| brand_secondary_color | text | Cor secundaria da interface |

#### `workspace_members`

Vinculacao de usuarios a workspaces com controle de role.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| workspace_id | uuid FK | Referencia ao workspace |
| user_id | uuid FK | Referencia ao auth.users |
| role | text | 'owner', 'admin', 'editor', 'viewer' |

Constraint: UNIQUE(workspace_id, user_id).

#### `brand_kits`

Identidade visual dos carrosseis. Um workspace pode ter multiplos Brand Kits.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| workspace_id | uuid FK | Referencia ao workspace |
| name | text | Nome do Brand Kit |
| colors | jsonb | { primary, secondary, accent, background, text } |
| fonts | jsonb | { heading: { family, url }, body: { family, url } } |
| logo_url | text | Logo para usar nos carrosseis |
| avatar_url | text | Avatar para usar nos carrosseis |
| tone_of_voice | text | Instrucao de tom para IA |
| is_default | boolean | Se e o Brand Kit padrao do workspace |

#### `ai_configs`

Configuracao de IA por workspace. API keys encrypted via Vault.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| workspace_id | uuid FK | Referencia ao workspace |
| llm_provider | text | 'openai', 'anthropic', 'google', 'groq' |
| llm_api_key | text | Chave da API LLM (encrypted) |
| llm_model | text | Modelo especifico (ex: 'gpt-4o') |
| imagen_api_key | text | Chave da API Gemini Imagen (encrypted) |
| supadata_api_key | text | Chave da API Supadata (encrypted) |

#### `templates` e `template_slide_variants`

Sistema de templates com variacoes por posicao de slide. Templates do sistema (`is_system = true`) tem `workspace_id = NULL`.

#### `carousels` e `carousel_slides`

Carrosseis criados pelos usuarios. `canvas_json` armazena o estado completo do Konva Stage serializado. `carousel_slides` tem `workspace_id` desnormalizado para simplificar RLS.

#### `carousel_versions`

Historico de versoes com snapshot completo de todos os slides.

#### `custom_fonts`

Fontes customizadas com suporte a weight e style. Upload via Supabase Storage.

#### `meta_connections`

Tokens OAuth do Meta (encrypted via Vault) com controle de expiracao.

#### `scheduled_posts`

Posts agendados com status tracking (pending, publishing, published, failed).

#### `schema_versions`

Controle de migrations incrementais. RLS: SELECT via anon key, INSERT/UPDATE/DELETE apenas via service role.

### RLS (Row Level Security) e Seguranca por Role

Todas as tabelas com `workspace_id` tem RLS habilitado. Regras:

1. **Regra geral**: `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())`.

2. **Excecao `templates`**: SELECT inclui templates globais (`workspace_id IS NULL`). Modificacao exige `workspace_id IS NOT NULL`.

3. **Excecao `platform_config`**: RLS bloqueia 100%. Acesso via RPC `get_setup_status()`.

4. **Excecao `template_slide_variants`**: policy via subquery em `templates`.

5. **Policies granulares por role** usando helper SQL `get_user_role()`:

```sql
CREATE FUNCTION get_user_role(p_workspace_id uuid)
RETURNS text AS $$
  SELECT role FROM workspace_members
  WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Estrategia de Criptografia (Supabase Vault)

- **Supabase Vault** (baseado em pgsodium) e usado para criptografia de todos os secrets.
- Vault gerencia chaves de criptografia separadamente dos dados, eliminando o anti-pattern de armazenar chave junto dos dados criptografados.
- Secrets criptografados: API keys LLM, API key Gemini Imagen, API key Supadata, Meta App Secret, access tokens OAuth.

---

## 5. Seguranca

### Principios Fundamentais

1. **Service Role Key nunca toca o browser**: disponivel apenas como env var nativa nas Edge Functions (`Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`).

2. **API keys nunca expostas no frontend**: todas as chamadas a providers externos (LLM, Imagen, transcricao, Meta) sao proxiadas via Edge Functions.

3. **RLS granular por role**: policies verificam role explicitamente, nao apenas presenca no workspace.

4. **Secrets via Supabase Vault**: nunca armazenar chave de criptografia junto dos dados.

5. **Validacao em todas as fronteiras**: inputs do Wizard, respostas de IA, uploads de arquivos, canvas_json.

### Edge Functions como Proxy Seguro

Todas as Edge Functions seguem o mesmo protocolo de seguranca:

1. Validar JWT do usuario (Supabase Auth).
2. Verificar pertencimento ao workspace via `workspace_members`.
3. Descriptografar API keys server-side via Supabase Vault.
4. Implementar rate limiting por workspace (usando Deno.kv ou Supabase como state store).
5. Sanitizar inputs e validar outputs.

| Edge Function | Funcao | Seguranca Especifica |
|--------------|--------|---------------------|
| `bootstrap` | Executar migrations | Usa Service Role Key nativa; migrations 100% estaticas |
| `generate-content` | Proxy LLM | API key descriptografada server-side; rate limit |
| `generate-image` | Proxy Gemini Imagen | Mesma logica de seguranca |
| `transcribe` | Proxy Supadata/Whisper | API key server-side |
| `meta-oauth` | Token exchange OAuth | App Secret server-side; state parameter CSRF |
| `schedule-post` | Publicacao Instagram | Access token descriptografado server-side |
| `webhook-meta` | Receber webhooks Meta | Validacao de assinatura |

### Fluxo de Bootstrap Seguro

1. O cliente deploya Edge Functions (`npx content-hub deploy-functions`) antes de iniciar o Wizard.
2. No Step 1, o usuario insere apenas URL e Anon Key (nunca Service Role Key).
3. Frontend valida conexao com `SELECT 1`.
4. Frontend envia migrations SQL estaticas a Edge Function `bootstrap`.
5. Edge Function usa Service Role Key nativa do Deno para executar migrations.
6. Service Role Key nunca trafega pelo browser.

### OAuth Meta Seguro

1. Frontend inicia fluxo OAuth com parametro `state` (CSRF token gerado e armazenado em sessao).
2. Usuario autoriza no Meta.
3. Authorization code retornado ao callback URL.
4. Frontend envia code a Edge Function `meta-oauth`.
5. Edge Function faz token exchange usando App Secret (server-side).
6. Access token armazenado encrypted via Vault.
7. `redirect_uri` validada contra whitelist de dominios autorizados.

### Upload Seguro

- Buckets **privados** com signed URLs (expiracao curta).
- Validacao de MIME type real via magic bytes (nao extensao de arquivo).
- Limites: fontes max 2MB, imagens max 10MB.
- Whitelist de MIME types no Supabase Storage.
- Servido com `Content-Disposition: attachment`.

### Headers de Seguranca (Vercel)

Configurados em `vercel.json`:

| Header | Valor |
|--------|-------|
| Content-Security-Policy | Restritivo: bloquear scripts inline e de terceiros |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |

CORS: cada cliente configura no Supabase Dashboard com dominio exato (nunca wildcard `*`).

### Validacoes Adicionais

- **canvas_json**: schema Zod para validacao no save e load. Limite de 5MB. URLs com protocolos nao-HTTPS rejeitadas (prevencao de `javascript:` URLs).
- **CSS variables**: validacao de formato hex/rgb antes da injecao de cores dinamicas.
- **Prompt injection**: delimitadores claros no prompt, validacao Zod rigorosa do output do LLM, codigo retornado pelo LLM nunca e executado.
- **Rate limiting**: por workspace (ex: max 100 geracoes IA/dia). Rate limit nativo do Supabase Auth para login.

### Checklist Pre-Deploy

- [ ] Edge Functions deployadas (`npx content-hub deploy-functions`)
- [ ] RLS habilitado em todas as tabelas
- [ ] `platform_config` inacessivel via anon key
- [ ] CORS configurado com dominio especifico no Supabase
- [ ] Rate limiting ativo nas Edge Functions
- [ ] Supabase Vault habilitado para criptografia
- [ ] CSP headers configurados na Vercel
- [ ] Meta OAuth redirect_uri na whitelist

---

## 6. Fases de Implementacao

### Fase 1 - Fundacao e Wizard

**Objetivo**: infraestrutura base, setup do monorepo, Wizard de onboarding completo.

**Dependencias**: nenhuma (e o ponto de partida).

**Complexidade**: Alta. E a fase mais critica porque define toda a base sobre a qual o resto sera construido.

**Itens**:

1. Setup monorepo com pnpm workspaces + Vite + React + Tailwind + shadcn/ui.
2. SQL migrations (todas as tabelas, incluindo `platform_config` e `schema_versions`).
3. Edge Function `bootstrap` (execucao de migrations server-side).
4. Script `npx content-hub deploy-functions` (automatiza deploy de Edge Functions).
5. Wizard Step 1: Conectar Supabase (validacao + migrations via Edge Function).
6. Supabase client dinamico (localStorage bootstrap) + funcao RPC `get_setup_status()`.
7. Auth (email/senha via Supabase Auth).
8. Wizard Steps 2-3: Criar workspace + White-label (CSS variables, logo, dominio).
9. Multi-tenancy (workspace CRUD, member management, RLS granular por role).
10. Wizard Steps 5-6: Config IA + Conectar Instagram (Meta OAuth via Edge Function).

### Fase 2 - Brand Kit e Templates

**Objetivo**: sistema de identidade visual e templates reutilizaveis.

**Dependencias**: Fase 1 (workspaces, auth, RLS).

**Complexidade**: Media. CRUD padrao com adicao de upload de fontes e layouts JSON.

**Itens**:

1. Brand Kit CRUD (cores, fontes, logo, tom de voz).
2. Upload de fontes customizadas + font-face injection via FontFace API.
3. Sistema de templates (CRUD, categorias, variacoes por slide).
4. 5 templates iniciais do sistema (seed data + layouts JSON Konva).

### Fase 3 - Inteligencia Artificial

**Objetivo**: geracao de conteudo, transcricao e geracao de imagens por IA.

**Dependencias**: Fase 1 (Edge Functions, ai_configs) + Fase 2 (Brand Kit para tom de voz, templates para estrutura).

**Complexidade**: Alta. Envolve adapter pattern multi-provider, prompt engineering, validacao Zod rigorosa do output e proxy server-side para seguranca.

**Itens**:

1. Config de IA por workspace (provider picker, API key storage via Vault).
2. Edge Function `generate-content` (proxy LLM multi-provider com adapter pattern).
3. Edge Function `transcribe` (proxy Supadata/Whisper).
4. Edge Function `generate-image` (proxy Gemini Imagen).
5. Geracao de conteudo: frontend -> Edge Function -> LLM -> JSON de slides.
6. Extracao de transcricao (YouTube, Reels, Twitter).
7. Tela de preview (aceitar/rejeitar/regenerar).

### Fase 4 - Editor Visual

**Objetivo**: editor completo de carrosseis com Konva.js.

**Dependencias**: Fase 2 (Brand Kit, templates) + Fase 3 (conteudo gerado por IA para popular o editor).

**Complexidade**: Muito Alta. Editor visual e a funcionalidade mais complexa do projeto. Envolve canvas 2D, layers, transformacoes, undo/redo, smart guides, mascaras e performance.

**Itens**:

1. Editor Konva.js (Stage, Layers, elementos basicos).
2. Painel de slides (thumbnails, reordenacao drag-and-drop).
3. Toolbar de elementos (texto, imagem, shape, icone).
4. Painel de propriedades (sidebar direita, contextual).
5. Layers panel com z-index.
6. Smart guides e snap to grid.
7. Mascaras de imagem.
8. Geracao de imagem com Gemini Imagen no editor.
9. Undo/Redo (Zustand middleware).
10. Suporte a video/GIF.

### Fase 5 - Exportacao e Publicacao

**Objetivo**: exportar carrosseis como PNG e publicar/agendar no Instagram.

**Dependencias**: Fase 4 (editor para gerar canvas_json) + Fase 1 (Meta OAuth).

**Complexidade**: Media-Alta. Exportacao client-side e direta; integracao com Meta API requer atencao a edge cases e token management.

**Itens**:

1. Export PNG client-side (Konva `stage.toDataURL()` + upload Storage).
2. Download em lote (ZIP via JSZip).
3. Integracao Meta OAuth completa.
4. Publicacao no Instagram via Meta Content Publishing API.
5. Agendador nativo (pg_cron + pg_net para invocar Edge Functions).
6. Webhooks de eventos (carousel.created, carousel.exported, carousel.published).

### Fase 6 - Polish

**Objetivo**: funcionalidades secundarias e refinamento.

**Dependencias**: Fases 1-5 (todas as funcionalidades core).

**Complexidade**: Media. Funcionalidades independentes que podem ser implementadas em qualquer ordem.

**Itens**:

1. Versionamento de carrosseis (historico, restauracao).
2. Salvar template customizado a partir de carrossel editado.
3. QR Code generator.
4. Graficos (mini chart component para slides de estatistica).

### Diagrama de Dependencias entre Fases

```
Fase 1 (Fundacao)
    |
    +-------+-------+
    |               |
    v               v
Fase 2          Fase 3
(Brand Kit)     (IA)
    |               |
    +-------+-------+
            |
            v
        Fase 4
        (Editor)
            |
            v
        Fase 5
        (Export)
            |
            v
        Fase 6
        (Polish)
```

---

## 7. Diferenciais Tecnicos

### Por que essa arquitetura e superior

1. **Zero vendor lock-in no backend**: o cliente pode migrar seu Supabase ou trocar de instancia a qualquer momento. O frontend e portatil.

2. **Custos previssiveis e transparentes**: sem servidor intermediario, o unico custo e Supabase + Vercel + API keys de IA, todos sob controle direto do cliente.

3. **Seguranca por design**: Service Role Key nunca toca o browser. API keys nunca expostas. RLS granular. Vault para criptografia. Edge Functions como barreira de seguranca.

4. **Escalabilidade sem gestao**: Supabase escala automaticamente. Vercel CDN distribui o frontend globalmente. Nao ha servidor para monitorar ou escalar manualmente.

5. **Extensibilidade do LLM**: adapter pattern permite adicionar novos providers criando apenas um arquivo novo, sem alterar codigo existente. Open/Closed principle aplicado.

6. **Exportacao client-side**: elimina necessidade de Puppeteer server-side, reduzindo custos e complexidade. Fontes ja estao carregadas no browser via FontFace API.

### Trade-offs Aceitos

| Trade-off | Justificativa |
|-----------|---------------|
| **Sem dark mode no MVP** | Simplifica o CSS e acelera entrega. Pode ser adicionado depois via Tailwind dark variants |
| **Editor nao funciona em mobile** | Editar canvas 2D em mobile e uma experiencia ruim. Exibir mensagem "Use no desktop" em telas < 1024px e melhor que forcar uma UX degradada |
| **Sem billing interno** | Cada cliente white-label tem seu proprio modelo de negocio. Forcar um billing padrao seria restritivo. Controle comercial externo e mais flexivel |
| **Setup requer deploy de Edge Functions** | Pre-requisito necessario para seguranca (Service Role Key server-side). Mitigado pelo script `npx content-hub deploy-functions` |
| **localStorage para bootstrap** | Necessario porque nao ha backend proprio para armazenar credenciais iniciais. Apenas URL e Anon Key sao armazenados (informacoes que ja sao publicas na SDK do Supabase) |
| **Sem colaboracao real-time no MVP** | Locking simples via campo `editing_by` e suficiente. CRDTs podem ser adicionados no futuro |
| **Idioma apenas pt-BR** | Publico-alvo e brasileiro. Internacionalizacao pode ser adicionada depois com i18n |

### Decisoes Arquiteturais Nao-Obvias

1. **Migrations bundled no frontend**: as migrations SQL sao strings estaticas importadas no frontend e enviadas a Edge Function `bootstrap` para execucao. Isso parece contra-intuitivo (SQL no frontend?), mas e seguro porque: (a) sao strings estaticas sem interpolacao de input, (b) sao executadas server-side pela Edge Function com Service Role Key, (c) o frontend nao tem acesso direto ao banco com privilegios elevados.

2. **workspace_id desnormalizado em `carousel_slides` e `carousel_versions`**: parece violar normalizacao, mas simplifica drasticamente as policies RLS. Sem essa desnormalizacao, cada policy precisaria de um JOIN com `carousels` para obter o workspace_id, impactando performance e aumentando complexidade.

3. **Supabase client criado dinamicamente**: diferente de apps tradicionais onde o client Supabase e configurado em build time, aqui ele e criado em runtime a partir de valores no localStorage. Isso e fundamental para o modelo white-label onde cada instancia aponta para um Supabase diferente.

4. **Edge Functions como proxy para tudo**: pode parecer overhead desnecessario, mas garante que nenhuma API key de terceiro trafegue pelo browser. O custo de latencia adicional (uma hop extra) e compensado pela seguranca.

5. **pg_cron + pg_net para agendamento**: pg_cron executa SQL, nao HTTP. A extensao pg_net complementa permitindo chamadas HTTP a partir de SQL, o que viabiliza invocar Edge Functions a partir de cron jobs sem infraestrutura adicional.

6. **Exportacao client-side em vez de server-side (Puppeteer)**: a decisao de exportar via Konva.js no browser elimina a necessidade de uma Edge Function com Puppeteer (que seria pesada e cara). A pre-condicao e que as fontes estejam carregadas via FontFace API, o que e garantido pelo fluxo do editor.

7. **Schema Zod para validacao de canvas_json**: o canvas_json pode conter URLs, e um atacante poderia inserir `javascript:` URLs. A validacao Zod rejeita protocolos nao-HTTPS, prevenindo XSS via canvas.

8. **get_setup_status() como SECURITY DEFINER**: a tabela `platform_config` e completamente bloqueada via RLS. A unica forma do frontend saber se o setup foi completado e via essa funcao RPC que retorna apenas dois campos booleano/inteiro, sem expor dados sensiveis.

---

*Documento gerado como referencia tecnica completa para desenvolvedores do projeto Content Hub.*
