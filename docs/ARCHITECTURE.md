# Arquitetura Técnica — Agiliza Network

> Documento de referência para decisões arquiteturais do monorepo.  
> Última atualização: Setembro 2026

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGILIZA NETWORK                               │
│  (Turborepo Monorepo — npm workspaces)                              │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ agiliza  │ │ agiliza  │ │ agiliza  │ │ agiliza  │ │ agiliza  │  │
│  │   -pdf   │ │  -media  │ │  -calc   │ │   -qr    │ │  -bio    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │            │          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ agiliza  │ │ agiliza  │ │ agiliza  │ │ agiliza  │ │ agiliza  │  │
│  │  -nota   │ │  -img    │ │  -text   │ │  -dev    │ │  -sign   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       └────────────┴────────────┴────────────┴────────────┘          │
│                                  │                                    │
│              ┌───────────────────┼───────────────────┐               │
│              ▼                   ▼                   ▼               │
│        @agiliza/ui        @agiliza/utils    @agiliza/config-*        │
│        (Design System)    (Shared logic)    (ESLint/TS/Tailwind)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Decisão: Monorepo vs. Polyrepo

### Por que Monorepo com Turborepo?

| Critério | Monorepo ✅ | Polyrepo ❌ |
|---------|-----------|-----------|
| Design System compartilhado | Mudança única propaga para todos | PR em cada repo |
| Cache de builds | Turborepo Remote Cache entre todas as apps | Cache isolado por repo |
| Refactoring cross-tool | Uma PR abrange tudo | Múltiplas PRs coordenadas |
| SEO cross-linking | Tipagem e dados compartilhados | Duplicação de constantes |
| Onboarding | Um `npm install` para tudo | Setup por ferramenta |

---

## 3. Fluxo de Dados por Categoria de Ferramenta

### 3.1 Client-Side Only (8 ferramentas)

```
Browser
  ├── User Input / File Upload
  │     │
  │     ▼
  ├── React Component (Next.js — SSG/ISR)
  │     │
  │     ▼
  ├── Processing Library (WASM / Canvas / Pure JS)
  │     │ PDF.js, pdf-lib, qrcode.js, jsPDF, jimp, etc.
  │     ▼
  └── Output (Download / Render / Copy)

Zero requests to backend. Zero egress cost.
```

**Apps nesta categoria:** `agiliza-pdf`, `agiliza-calc`, `agiliza-qr`, `agiliza-nota`, `agiliza-img`, `agiliza-text`, `agiliza-dev`, `agiliza-sign`

### 3.2 Client + Supabase (`agiliza-bio`)

```
Browser (Next.js)
  ├── Supabase Auth (OAuth / Magic Link)
  │     └── JWT stored in httpOnly cookie
  ├── Supabase Client SDK
  │     ├── READ: fetch public profile pages (anon key)
  │     └── WRITE: CRUD de links (authenticated)
  └── Vercel Edge (SSR para SSG de perfis públicos)
        └── ISR com revalidação a cada 60s
```

**Modelo de dados Supabase:**
```sql
-- profiles
id          uuid  PRIMARY KEY DEFAULT auth.uid()
username    text  UNIQUE NOT NULL
display_name text
avatar_url  text
bio         text
theme       text DEFAULT 'default'
created_at  timestamptz DEFAULT now()

-- links
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id  uuid REFERENCES profiles(id) ON DELETE CASCADE
title       text NOT NULL
url         text NOT NULL
icon        text
order_index integer DEFAULT 0
is_active   boolean DEFAULT true
click_count integer DEFAULT 0
created_at  timestamptz DEFAULT now()
```

### 3.3 Serverless Externo (`agiliza-media`)

```
Browser
  ├── POST /api/extract (Next.js API Route — Vercel)
  │     └── Valida URL + rate-limit (upstash/redis)
  │           │
  │           ▼
  │     Microserviço (Render/Fly.io — Python/FastAPI)
  │           ├── yt-dlp --format best
  │           └── Retorna stream URL temporária (S3/R2 signed URL)
  │                 │
  │                 ▼
  └── Browser faz download direto da signed URL
```

**Stack do microserviço:**
- Python 3.12 + FastAPI
- yt-dlp (sempre atualizado via `pip install -U yt-dlp`)
- Cloudflare R2 para armazenamento temporário (TTL: 10 min)
- Rate limiting: 3 downloads/IP/hora

---

## 4. Estratégia de Deploy

### 4.1 Vercel (Apps Next.js)

Cada app em `apps/*` é um projeto separado na Vercel (time `agilizatools`), conectado ao repositório `agilizatoolsoficial/agiliza-network` (branch `main`), com `Root Directory` apontando para o respectivo diretório (`apps/web` ou `apps/agiliza-*`), preset `Next.js`, Node `24.x` e `Include files outside the root directory` habilitado.

**Domínios definitivos (Vercel Hobby / HTTPS automático gerenciado pela Vercel):**
| App | Projeto Vercel | Root Directory | URL Canônica |
|-----|----------------|----------------|--------------|
| portal (`web`) | `agiliza-network` | `apps/web` | `https://agiliza-network.vercel.app` |
| `agiliza-pdf` | `agiliza-pdf` | `apps/agiliza-pdf` | `https://agiliza-pdf.vercel.app` |
| `agiliza-media` | `agiliza-media` | `apps/agiliza-media` | `https://agiliza-media.vercel.app` |
| `agiliza-calc` | `agiliza-calc` | `apps/agiliza-calc` | `https://agiliza-calc.vercel.app` |
| `agiliza-qr` | `agiliza-qr` | `apps/agiliza-qr` | `https://agiliza-qr.vercel.app` |
| `agiliza-bio` | `agiliza-bio` | `apps/agiliza-bio` | `https://agiliza-bio.vercel.app` |
| `agiliza-nota` | `agiliza-nota` | `apps/agiliza-nota` | `https://agiliza-nota.vercel.app` |
| `agiliza-img` | `agiliza-img` | `apps/agiliza-img` | `https://agiliza-img.vercel.app` |
| `agiliza-text` | `agiliza-text` | `apps/agiliza-text` | `https://agiliza-text.vercel.app` |
| `agiliza-dev` | `agiliza-dev` | `apps/agiliza-dev` | `https://agiliza-dev.vercel.app` |
| `agiliza-sign` | `agiliza-sign` | `apps/agiliza-sign` | `https://agiliza-sign.vercel.app` |

**Centralização e variáveis de ambiente:**
Todas as URLs ficam centralizadas em `packages/ui/src/config/urls.ts` e podem ser sobrescritas por variáveis de ambiente (`NEXT_PUBLIC_PORTAL_URL` e `NEXT_PUBLIC_TOOL_<ID>_URL`) caso o projeto migre para um domínio próprio no futuro.

**Publicação e certificados TLS:**
- Cada merge na branch `main` dispara automaticamente o deploy de produção na Vercel para os projetos afetados.
- Os certificados HTTPS dos domínios `*.vercel.app` são emitidos e renovados automaticamente pela Vercel (TLS gerenciado pela plataforma, sem renovação manual).

### 4.2 Cloudflare (DNS + CDN)

- DNS autoritativo: Cloudflare (grátis)
- Todos os subdomínios apontam para Vercel com proxy Cloudflare ativo
- Cache de assets estáticos no edge Cloudflare
- Workers para rate-limiting adicional

---

## 5. SEO Architecture

### 5.1 Metadata por App

```typescript
// Padrão em cada apps/agiliza-{tool}/app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: '%s | AgilizaTool — Agiliza Network',
    default: 'AgilizaTool — Descrição da ferramenta',
  },
  description: 'Descrição única com keywords alvo (150-160 chars)',
  keywords: ['keyword1', 'keyword2'],
  authors: [{ name: 'Rede Agiliza', url: PORTAL_URL }],
  openGraph: {
    type: 'website',
    siteName: 'Agiliza Network',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@agilizatools',
  },
  alternates: {
    canonical: '/',
  },
}
```

### 5.2 JSON-LD Padrão

```typescript
// packages/ui/src/components/JsonLd.tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: toolName,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
  url: toolUrl,
  publisher: {
    '@type': 'Organization',
    name: 'Rede Agiliza',
    url: PORTAL_URL,
  },
}
```

### 5.3 Estratégia de Cross-Linking

O `<NetworkFooter />` presente em TODAS as 10 ferramentas contém links para todas as outras ferramentas. Isso cria uma malha de autoridade interna que distribui PageRank entre os domínios da rede.

**Anchor text estratégico por ferramenta:**
- `Comprimir PDF grátis online` → agiliza-pdf
- `Baixar vídeo sem marca d'água` → agiliza-media
- `Calculadora CLT vs PJ` → agiliza-calc
- `Gerar QR Code Pix` → agiliza-qr
- `Criar página de links grátis` → agiliza-bio
- `Gerar recibo online` → agiliza-nota
- `Comprimir imagem online` → agiliza-img
- `Contar caracteres online` → agiliza-text
- `Gerar CPF para teste` → agiliza-dev
- `Assinar PDF online` → agiliza-sign

---

## 6. Performance Budget

| Métrica | Target | Método |
|---------|--------|--------|
| LCP | < 2.5s | SSG + CDN |
| FID/INP | < 100ms | Lazy loading de libs pesadas |
| CLS | < 0.1 | Skeleton screens + dimensões fixas |
| Bundle JS | < 150KB (first load) | Dynamic imports para libs WASM |
| Lighthouse Score | > 95 | Todas as categorias |

### Lazy Loading de Libs Pesadas

```typescript
// Exemplo: carregar pdf-lib somente quando necessário
const PDFProcessor = dynamic(
  () => import('@/lib/pdf-processor').then(m => m.PDFProcessor),
  { ssr: false, loading: () => <ProcessingSpinner /> }
)
```

---

## 7. Segurança

### Política de Validação de Input

- **Files:** Validação de magic bytes (não apenas extensão), limite de tamanho por tipo
- **URLs (AgilizaMedia):** Whitelist de domínios suportados no cliente + servidor
- **Dados pessoais (AgilizaDev):** CPFs/CNPJs gerados são fictícios e marcados como `[TESTE]`
- **AgilizaBio:** Sanitização de URLs de links com `DOMPurify`, CSP headers rigorosos

### Headers de Segurança (next.config.ts)

```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]
```

---

## 8. Turborepo Pipeline

```json
// turbo.json (expandido para o projeto)
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

**Ordem de build garantida pelo grafo de dependências:**
```
@agiliza/config-typescript
  └── @agiliza/config-eslint
  └── @agiliza/config-tailwind
        └── @agiliza/utils
              └── @agiliza/ui
                    └── apps/* (todas as 10 apps)
```

---

## 9. Decisões Técnicas Registradas (ADRs)

### ADR-001: Client-Side First para processamento de arquivos
**Decisão:** Processar PDFs, imagens e documentos 100% no browser.  
**Motivo:** Elimina custo de servidor, melhora privacidade do usuário (dados não saem do dispositivo), e reduz latência.  
**Trade-off:** Dispositivos móveis mais lentos podem ter performance limitada para arquivos grandes (> 50MB).

### ADR-002: Turborepo sobre Nx
**Decisão:** Usar Turborepo como orchestrador do monorepo.  
**Motivo:** Integração nativa com Vercel Remote Cache, configuração mais simples, suporte oficial ao ecossistema Next.js.

### ADR-003: Supabase sobre PlanetScale/Neon para AgilizaBio
**Decisão:** Supabase (PostgreSQL + Auth nativo).  
**Motivo:** Auth completo (OAuth, Magic Link) incluído sem custo adicional. Row Level Security (RLS) nativo. Free tier generoso para MVP.

### ADR-004: Subdomínios independentes vs. paths no mesmo domínio
**Decisão:** Projetos e hosts independentes por app (`agiliza-pdf.vercel.app` vs `agiliza-network.vercel.app/pdf`).  
**Motivo:** Permite deploys Vercel independentes por app, sem risco de breaking change cruzado. Cada ferramenta tem autonomia de release. Trade-off: cada subdomínio acumula autoridade SEO separadamente.
