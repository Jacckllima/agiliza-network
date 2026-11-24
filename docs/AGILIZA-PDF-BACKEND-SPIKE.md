# Spike Arquitetural: Backend para Conversões Office, PDF/A e Reparo de PDF (`agiliza-pdf`)

> **Issue:** #47  
> **Status:** Proposta técnica (aguardando validação de orçamento e aprovação antes de implementação)  
> **Escopo:** Fase 2 opcional com backend dedicado para `apps/agiliza-pdf`

---

## 1. Contexto e Separação Clara de Escopo

A Fase 1 do `agiliza-pdf` (#38 a #46) foi entregue 100% client-side no navegador. Contudo, um subconjunto específico de operações exige binários nativos pesados (`LibreOffice`, `Ghostscript`, `QPDF`, `Poppler`) que **não são viáveis** nem no navegador (WebAssembly excessivamente pesado e sem fontes de sistema) nem nas funções serverless da Vercel Hobby (limite de bundle, ausência de LibreOffice e timeout curto).

### O que permanece 100% client-side (Fase 1, já entregue)
- Organizar PDF: juntar, dividir/extrair, girar, remover páginas.
- Converter de PDF: PDF para PNG/JPG, extração de texto (`.txt`) e PDF para Markdown (`.md`).
- Converter em PDF: imagens (`JPG`, `PNG`, `WebP`), texto (`.txt`, `.md`), HTML simples e CSV.
- Assinar PDF visualmente, editar (numeração, marca d'água, recortar, achatar, formulários, tarjar, comparar).
- Segurança AES-256 (proteger/desbloquear com senha), Scanner por câmera, OCR local (`tesseract.js`) e Otimizar/Comprimir PDF.

### O que entra na eventual Fase 2 com backend dedicado
1. **Office e e-books para PDF:** `.docx`, `.doc`, `.xlsx`, `.xls`, `.pptx`, `.ppt`, `.odt`, `.ods`, `.odp`, `.rtf`, `.epub` (observação: `.pages` da Apple não tem suporte nativo fiel no LibreOffice fora do macOS e deve ficar fora do escopo inicial ou sinalizado como não suportado).
2. **PDF para Office editável:** PDF para `.docx`, `.xlsx` (extração de tabelas) e `.pptx`.
3. **PDF para PDF/A (arquivamento ISO 19005):** conversão e validação de perfil `PDF/A-2b` ou `PDF/A-3b` via Ghostscript/veraPDF.
4. **Reparar PDF corrompido:** reconstrução de tabela XREF, streams danificados e estrutura interna via `qpdf` + `gs` (Ghostscript).

---

## 2. Comparativo de Opções de Infraestrutura

| Critério | Opção A: Microserviço Docker próprio (Gotenberg + QPDF/Ghostscript) | Opção B: Stirling-PDF self-hosted como API interna | Opção C: APIs comerciais (CloudConvert / ConvertAPI / Adobe PDF Services) |
|---|---|---|---|
| **Motores inclusos** | LibreOffice headless + Chromium + QPDF + Ghostscript | LibreOffice + PDFBox + QPDF + Ghostscript + OCRmyPDF | Motores proprietários gerenciados |
| **Fidelidade Office ↔ PDF** | Alta em Office → PDF (com fontes `fonts-liberation`, `fonts-dejavu`, `fonts-crosextra-carlito/caladea`); média em PDF → DOCX (via `pdf2docx` ou LibreOffice) | Similar à Opção A (usa LibreOffice/PDFBox internamente) | Muito alta (especialmente PDF → Word/Excel/PPT complexos) |
| **Custo estimado mensal (referência)** | VPS 2 vCPU / 4 GB RAM (Hetzner/DigitalOcean/Fly.io/Render): ~US\$ 6 a US\$ 25/mês previsíveis | Similar à Opção A (requer 2 a 4 GB RAM mínimos) | Variável por conversão (~US\$ 0,008 a US\$ 0,05 por arquivo); pode escalar rápido em tráfego gratuito |
| **Latência típica** | 2s a 12s por documento (cold start baixo se container sempre ativo; ~15s+ se scale-to-zero) | 3s a 15s por documento | 3s a 15s (inclui upload/download extra até terceiro) |
| **Controle de privacidade (Retenção Zero)** | Total: o arquivo fica apenas em `/tmp` (ou `tmpfs` em RAM) e é apagado no `finally` da requisição | Alto, porém exige desativar logs de arquivo e histórico na configuração | Depende da política do terceiro (geralmente retém por minutos/horas até expirar) |
| **Esforço de manutenção** | Médio (atualizar imagem Docker, fontes e monitorar RAM/OOM) | Baixo a médio (imagem pronta, porém interface própria precisa ficar bloqueada externamente) | Baixo (sem servidor para manter), porém alto risco de custo imprevisível |

### Recomendação arquitetural
- **Opção recomendada para começar (MVP Fase 2): Opção A — Microserviço Docker enxuto** baseado em **Gotenberg** (para Office → PDF e PDF/A) somado a um wrapper leve Node/FastAPI com **QPDF + Ghostscript** (para Reparar PDF e PDF/A) e **`pdf2docx`** (para PDF → DOCX), hospedado em **VPS dedicada (2 vCPU / 4 GB RAM)** ou **Fly.io / Render** atrás de autenticação por token interno (`X-Agiliza-Internal-Secret`) acessado apenas via rotas proxy ou URL assinada.
- **Motivo:** custo mensal fixo e previsível, controle absoluto sobre exclusão imediata em RAM (`tmpfs`) e sem dependência de cobrança por unidade em tráfego gratuito.

---

## 3. Contrato de API, Limites e Segurança

### 3.1 Fluxo proposto
```text
Browser (apps/agiliza-pdf)
  │  1. Consentimento explícito de envio temporário
  │  2. Upload multipart/form-data (TLS/HTTPS)
  ▼
Gateway / API Proxy (ou endpoint dedicado api-pdf.agilizatools...)
  │  - Validação de extensão + assinatura mágica (magic bytes)
  │  - Rate limit por IP (Upstash Redis ou memória do proxy)
  │  - Limite estrito de tamanho (Content-Length)
  ▼
Worker Docker (tmpfs em RAM, sem disco persistente)
  │  - Executa conversão em diretório isolado por UUID (/dev/shm/job-<uuid>)
  │  - Timeout rígido por job (ex.: 45s) e fila com concorrência máxima (ex.: 2 jobs simultâneos por vCPU)
  │  - Retorna stream binário do arquivo convertido
  │  - Bloco finally: rm -rf /dev/shm/job-<uuid> (mesmo em erro/timeout)
  ▼
Browser recebe o arquivo e inicia download
```

### 3.2 Endpoints propostos (referência)
- `POST /v1/convert/office-to-pdf` (`multipart/form-data`: `file`) → `application/pdf`
- `POST /v1/convert/pdf-to-office` (`multipart/form-data`: `file`, `targetFormat=docx|xlsx|pptx`) → binário Office
- `POST /v1/convert/pdf-to-pdfa` (`multipart/form-data`: `file`, `profile=2b|3b`) → `application/pdf`
- `POST /v1/repair/pdf` (`multipart/form-data`: `file`) → `application/pdf`
- `GET /health` → `{ "status": "ok" }` (sem expor detalhes internos)

### 3.3 Política de Retenção Zero (obrigatória)
1. **Armazenamento em `tmpfs` (RAM):** arquivos temporários nunca devem ser gravados em disco persistente ou buckets de longa duração.
2. **Exclusão determinística:** cada requisição cria um diretório efêmero exclusivo e o remove no `finally` imediatamente após enviar o stream de resposta (e um cron/sweeper interno remove qualquer resíduo com mais de 2 minutos em caso de crash do processo).
3. **Logs sem dados pessoais:** registrar apenas `requestId`, `operation`, `durationMs`, `statusCode` e `fileSizeBucket` — **nunca** registrar nome original do arquivo, conteúdo ou IP em texto puro.
4. **Feature flag de desligamento seguro:** no front-end (`apps/agiliza-pdf`), as abas de conversão com backend só ficam habilitadas quando `NEXT_PUBLIC_PDF_BACKEND_URL` (e chave no servidor) estiver configurada; sem ela, a UI não quebra e informa que o recurso não está ativo.

---

## 4. Proposta de Limites: Modo Gratuito vs. Futuro Plano Pago

*(Proposta inicial para validação do usuário — não constitui preço nem oferta confirmada.)*

| Parâmetro | Modo Gratuito (proposto) | Futuro Plano Pago (visão) |
|---|---|---|
| Arquivos por operação | 1 arquivo por vez | Lote (ex.: até 10 arquivos / ZIP) |
| Tamanho máximo de upload | 10 MB a 15 MB | 50 MB a 100 MB |
| Rate-limit | Ex.: 5 conversões/hora e 15/dia por IP | Cota mensal dedicada por conta |
| Operações elegíveis | Office → PDF, Reparar PDF, PDF/A básico | PDF → Office editável de alta complexidade, lotes e fila prioritária |

---

## 5. Casos de Erro e Mitigações

- **Timeout em documentos Office pesados ou planilhas gigantes:** aplicar timeout rígido (45s), encerrar o processo filho (`SIGKILL`) no `finally`, limpar `/dev/shm/job-<uuid>` e retornar HTTP `504` com mensagem clara sugerindo dividir o documento.
- **Fontes ausentes no servidor Linux:** instalar pacote de fontes metricamente compatíveis (`fonts-liberation`, `fonts-dejavu`, `fonts-crosextra-carlito` para Calibri, `fonts-crosextra-caladea` para Cambria, `fonts-noto`) na imagem Docker e avisar na UI que pequenos ajustes tipográficos podem ocorrer.
- **ZIP bombs / macros maliciosas em arquivos Office:** rodar o LibreOffice em usuário sem privilégios, sem acesso à rede de saída (`--network=none` ou firewall egress bloqueado), com macros desabilitadas e limites de CPU/RAM por container (`--memory`, `--pids-limit`).
- **PDF severamente corrompido irrecuperável:** tentar `qpdf --replace-input` e fallback com Ghostscript; se ambos falharem, retornar HTTP `422` explicando honestamente que a estrutura do arquivo não pôde ser reconstruída.

---

## 6. Atualizações Obrigatórias Antes da Ativação (Privacidade e Termos)

Antes de colocar qualquer endpoint de backend em produção, os arquivos abaixo **devem** ser atualizados e revisados:
1. **`apps/web/app/privacidade/page.tsx`:**
   - Deixar explícita a diferença entre as ferramentas **100% locais** (Fase 1) e as conversões **processadas em servidor temporário** (Fase 2).
   - Informar qual provedor hospeda o worker Docker, que o tráfego usa HTTPS/TLS e que os arquivos são excluídos imediatamente da memória após a resposta (retenção zero).
2. **`apps/web/app/termos/page.tsx`:**
   - Especificar os limites de tamanho, taxa de uso e responsabilidade sobre documentos confidenciais enviados para conversão em servidor.
3. **Consentimento na UI do `apps/agiliza-pdf`:**
   - Exibir aviso claro antes do envio ("Esta conversão envia o arquivo temporariamente ao servidor da Rede Agiliza e o descarta imediatamente após o download").

---

## 7. Decisões em Aberto para o Usuário

Antes de abrir issues de implementação da Fase 2:
1. Qual orçamento mensal de infraestrutura (ex.: US\$ 5–10/mês em VPS vs. US\$ 15–25/mês em PaaS gerenciado como Fly.io/Render) faz sentido para o projeto?
2. Quais conversões são prioridade número 1 para o lançamento da Fase 2 (ex.: `Word/Excel/PPT → PDF` e `Reparar PDF` primeiro, deixando `PDF → Office` para a etapa seguinte)?
