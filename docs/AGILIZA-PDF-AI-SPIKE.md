# Spike Arquitetural: IA para PDF com Controle de Custo (`agiliza-pdf`)

> **Issue:** #48  
> **Status:** Proposta técnica (aguardando definição de provedor, chave de API e cota antes de implementação)  
> **Escopo:** Fase futura de recursos assistidos por modelo de linguagem no `apps/agiliza-pdf`

---

## 1. Contexto e Escopo Funcional

Os recursos solicitados para uma futura fase de **IA para PDF** são:
1. **Resumir PDF:** gera síntese estruturada (pontos-chave e resumo executivo) do conteúdo textual do documento.
2. **Chat com PDF:** perguntas e respostas fundamentadas estritamente no texto do documento carregado (com citação de página).
3. **Traduzir PDF:** tradução do conteúdo textual para idiomas comuns (ex.: Português, Inglês, Espanhol), com exportação em `.txt`/`.md` ou geração de novo PDF A4 de texto.
4. **Gerar questões de estudo:** cria perguntas objetivas ou discursivas com gabarito baseadas no documento.

Diferente da Fase 1 (100% local), esses recursos dependem de chamadas a uma API externa de modelo de linguagem (LLM), o que introduz **custo variável por token**, **risco de abuso automatizado** e **saída de dados do navegador do usuário**.

> **Diretriz obrigatória (`AGENTS.md`):** não exibir selos promocionais do tipo "feito com IA" no produto. Descrever cada ferramenta exclusivamente pelo que ela faz (ex.: "Resumir documento", "Perguntar ao documento", "Traduzir texto do PDF", "Gerar questões").

---

## 2. Arquitetura Recomendada: Extração Local + Rota Serverless Segura

Em vez de enviar o binário completo do PDF para o servidor (o que consome banda e memória na Vercel), a arquitetura aproveita o extrator client-side já implementado em `apps/agiliza-pdf/lib/pdf-to-media.ts` (`pdfjs-dist`) e o OCR local em `lib/pdf-ocr.ts` (`tesseract.js`):

```text
Browser (apps/agiliza-pdf)
  │  1. Extrai texto página a página localmente (pdfjs-dist)
  │     └─ Se não houver texto selecionável → orienta usar a aba Segurança e OCR primeiro
  │  2. Calcula contagem real de caracteres/páginas e valida limite máximo
  │  3. Exibe caixa de consentimento explícito antes do envio
  │  4. Envia APENAS { operation, pagesText, userPrompt, targetLanguage } via POST JSON
  ▼
Next.js Route Handler (apps/agiliza-pdf/app/api/pdf-assistant/route.ts)
  │  - Verifica feature flag / variável de ambiente (ex.: GEMINI_API_KEY)
  │    └─ Se ausente → retorna HTTP 503 com mensagem limpa (recurso desativado)
  │  - Valida payload (tamanho máximo em caracteres, schema rígido)
  │  - Aplica rate-limit por IP (Upstash Redis) + orçamento diário global (circuit breaker)
  │  - Chama API do provedor de LLM (chave mantida estritamente no servidor)
  │  - Faz streaming da resposta (SSE / ReadableStream) para reduzir tempo percebido
  ▼
Browser renderiza resposta e permite copiar ou exportar (.txt / .md / PDF)
```

### Vantagens desta arquitetura
- **Zero custo de upload de binários:** apenas texto limpo (alguns KB) trafega na API da Vercel.
- **Compatível com Vercel Hobby/Pro:** não exige Docker nem binários nativos.
- **Privacidade minimizada:** imagens embutidas no PDF nunca saem do navegador; apenas o trecho de texto autorizado pelo usuário é enviado.

---

## 3. Escolha de Provedor e Estimativa de Custo por Documento

### Comparativo de modelos de baixo custo (referência técnica)
- **Opção recomendada (custo/benefício + janela de contexto ampla): Gemini Flash (ex.: família Gemini 2.5 Flash / Flash-Lite via Google AI Studio / Gemini API).**
  - Janela de contexto grande (suporta documentos longos sem precisar de infraestrutura complexa de banco vetorial/RAG para PDFs de até ~30 páginas).
  - Custo por milhão de tokens de entrada/saída muito baixo na categoria Flash/Flash-Lite, com suporte nativo a streaming e saída estruturada (JSON para gerador de questões).
- **Alternativas viáveis:** OpenAI `gpt-4o-mini` / `gpt-4.1-mini` ou Anthropic `Claude Haiku`, usando uma interface de provedor abstraída (`lib/ai-provider.ts`) para evitar lock-in.

### Estimativa de ordem de grandeza por documento (referência)
Considerando 1 página média ≈ 500 palavras ≈ 700 tokens:
- **Documento curto (5 páginas ≈ 3.500 tokens de entrada + 800 tokens de saída):** custo estimado na faixa de **US\$ 0,0005 a US\$ 0,002** por operação em modelos Flash/Mini.
- **Documento médio (20 páginas ≈ 14.000 tokens de entrada + 1.500 tokens de saída):** custo estimado na faixa de **US\$ 0,002 a US\$ 0,008** por operação.
- **Tradução integral (saída proporcional à entrada):** exige teto menor de páginas por operação (ex.: até 10 páginas por vez) porque tokens de saída custam mais que tokens de entrada.

*(Valores são ordens de grandeza para planejamento; confirmar tabela vigente do provedor escolhido antes do lançamento.)*

---

## 4. Limites Rígidos e Proteção Contra Abuso

Para impedir estouro de fatura em tráfego público sem cadastro:

1. **Teto rígido de entrada por requisição:**
   - Resumo / Questões / Chat: máximo de **40.000 caracteres** (~15 a 20 páginas densas) no modo gratuito.
   - Tradução: máximo de **15.000 caracteres** (~5 a 8 páginas) por requisição.
   - Chat com PDF: histórico limitado às últimas **4 trocas** (8 mensagens) enviadas no payload, sem persistência em banco.
2. **Teto rígido de saída (`maxOutputTokens`):**
   - Resumo: até `1.200` tokens.
   - Chat: até `800` tokens por resposta.
   - Questões: até `1.500` tokens.
   - Tradução: até `4.000` tokens.
3. **Rate-limiting em duas camadas (Upstash Redis):**
   - **Por IP:** ex.: 3 requisições por hora e 10 por dia no modo gratuito.
   - **Circuit breaker global diário:** contador global de requisições/tokens por dia; ao atingir o teto definido por variável de ambiente (ex.: `PDF_AI_DAILY_BUDGET_REQUESTS=500`), a rota retorna HTTP `429` informando que a cota gratuita diária foi atingida até a meia-noite UTC.
4. **Proteção contra bots:** cabeçalho de origem (`Origin`/`Referer` validado para o domínio `agiliza-pdf.vercel.app`) e, se necessário em produção, verificação anti-abuso configurada explicitamente.
5. **Visão futura (modo gratuito vs. plano pago):**
   - **Gratuito (se ativado):** cota diária reduzida (ex.: 3 a 5 usos/dia, limite de 15 páginas) apenas para Resumo e Perguntas.
   - **Futuro plano pago mensal:** cota ampliada por conta autenticada, documentos maiores (até 50–100 páginas), tradução completa e exportação em lote.

---

## 5. Critério de Liberação (Feature Flag Segura)

A funcionalidade deve nascer **desativada por padrão** e controlada exclusivamente por variáveis de ambiente no servidor:
- `PDF_AI_ENABLED=true` (booleano explícito; padrão `false`).
- `PDF_AI_API_KEY=...` (somente server-side, **nunca** com prefixo `NEXT_PUBLIC_`).
- `PDF_AI_MODEL=...` (ex.: `gemini-2.5-flash`).
- `PDF_AI_DAILY_MAX_REQUESTS=...` (teto de segurança).

Comportamento quando não configurado:
- A rota `GET /api/pdf-assistant/status` retorna `{ "enabled": false }`.
- A UI não exibe erro quebrado nem solicita envio de texto; exibe apenas que o recurso não está habilitado nesta instância (ou oculta a aba até a ativação).

---

## 6. Casos de Erro e Bordas

- **PDF escaneado sem camada de texto:** o cliente detecta `hasSelectableText === false` antes de qualquer chamada de rede e orienta o usuário a rodar o **OCR Local** na aba **Segurança e OCR** primeiro.
- **PDF acima do limite de caracteres/páginas:** permitir que o usuário escolha um intervalo específico de páginas (ex.: `1-10`) em vez de truncar silenciosamente.
- **Falha ou cota excedida no provedor (HTTP `429` / `503`):** mapear para mensagens claras em português sem expor stack traces ou chaves de API.
- **Prompt injection no texto do PDF:** encapsular o conteúdo do documento em delimitadores explícitos (`<documento>...</documento>`) e instruir o prompt de sistema a tratar o conteúdo apenas como dado de leitura, nunca como comandos.

---

## 7. Consentimento Explícito e Impacto em Privacidade e Termos

Antes de ativar qualquer rota de IA em produção, será obrigatório:
1. **Consentimento explícito no fluxo da UI:** antes da primeira requisição da sessão, exigir confirmação visível do usuário informando que **o texto extraído das páginas selecionadas será enviado a um provedor externo de modelo de linguagem** (nomeando o provedor configurado) e que documentos confidenciais ou com dados pessoais sensíveis não devem ser enviados sem autorização.
2. **Atualização de `apps/web/app/privacidade/page.tsx`:**
   - Incluir o provedor de IA na seção de **Conexões Externas**, especificando que apenas o texto extraído das páginas escolhidas é enviado sob demanda, sem retenção em banco de dados pela Rede Agiliza, e linkando a política de retenção de API do provedor escolhido (preferencialmente nível pago/API sem uso para treinamento).
3. **Atualização de `apps/web/app/termos/page.tsx`:**
   - Esclarecer que resumos, traduções, respostas e questões geradas automaticamente podem conter imprecisões e devem ser revisados pelo usuário antes de uso acadêmico, profissional ou jurídico.

---

## 8. Decisões em Aberto para o Usuário

Antes de iniciar a implementação:
1. Qual provedor de API de IA pretende utilizar (ex.: Gemini API via Google AI Studio, OpenAI API, etc.)?
2. Os recursos de resumo/chat/tradução/questões devem ter uma pequena cota gratuita diária (com circuit breaker de custo) ou ficar reservados exclusivamente para o futuro plano pago?
