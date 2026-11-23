# Especificação Técnica e de Produto: AgilizaPDF (`apps/agiliza-pdf`)

> Documento de referência da arquitetura e evolução do `agiliza-pdf` (Issue #38).
> URL de produção: `https://agiliza-pdf.vercel.app`

---

## 1. Estado Atual vs. Escopo Planejado

Para manter total transparência entre o que já está publicado e o que será entregue nas próximas etapas, a tabela abaixo separa explicitamente cada funcionalidade por fase e issue:

| Categoria / Funcionalidade | Estado atual no código | Modelo de execução | Issue de entrega |
|---|---|---|---|
| Aviso de indisponibilidade (`Operações com PDF indisponíveis`) | Implementado | Client-side | Substituído a partir de #39 |
| Base UI, correção de Tailwind v4 (`globals.css`), tema claro padrão, acessibilidade, "Como usar", FAQ e `<AdSlot />` | Planejado | Client-side | #39 |
| **Organizar PDF:** juntar PDFs (com reordenação), dividir/extrair intervalos, girar e remover páginas | Planejado | 100% Client-side | #40 |
| **Converter de PDF:** PDF para JPG/PNG e extração de texto (`.txt`) | Planejado | 100% Client-side | #41 |
| **Converter em PDF:** imagens (`JPG`, `PNG`, `WebP`) e texto (`.txt`, `.md`) para PDF | Planejado | 100% Client-side | #42 |
| **Assinar PDF:** assinatura visual (desenho, texto ou imagem PNG) com posicionamento na página | Planejado | 100% Client-side | #43 |
| **Edição avançada:** números de página, marca d'água, recortar, achatar, formulários, anotações/texto simples, tarjar/ocultar e comparar PDFs | Planejado | 100% Client-side | #45 |
| **Segurança, extras, Scanner e OCR:** proteger/desbloquear com senha, HTML/CSV para PDF, PDF para Markdown, scanner por câmera e OCR no navegador | Planejado | 100% Client-side | #46 |
| **Otimizar/Comprimir PDF**, atualização do portal/políticas e validação completa no CI | Planejado | 100% Client-side | #44 |
| **Conversões Office, PDF/A e Reparo:** Word, Excel, PowerPoint, ODT, RTF, EPUB, Pages <-> PDF, PDF/A e Reparar PDF | Fora do escopo client-side (Spike) | Backend dedicado (Docker) | #47 |
| **IA para PDF:** resumir, chat com PDF, traduzir e gerar questões por IA | Fora do escopo client-side (Spike) | Backend + API de LLM | #48 |

*(Nota: o fluxo de "Solicitar assinaturas" com múltiplos signatários e envio por e-mail fica reservado ao app dedicado `apps/agiliza-sign`.)*

---

## 2. Regras de Produto, Limites Gratuitos e Evolução Futura

### 2.1 Fase Atual (100% Gratuita e Local)
- Todas as funcionalidades client-side do `agiliza-pdf` são **100% gratuitas** nesta fase, sem cadastro obrigatório e sem paywall.
- **Processamento 100% no navegador:** nenhum PDF, imagem ou texto enviado nas ferramentas client-side trafega por servidores da Rede Agiliza.
- **Limite operacional por ação:** processamento e download de **1 operação/arquivo resultante por vez** (na operação "Juntar PDFs", aceita múltiplos arquivos de entrada dentro do limite seguro para gerar 1 único PDF mesclado).
- **Limites seguros de memória no navegador (proteção contra travamento da aba):**
  - Tamanho máximo por arquivo de entrada: **25 MB** (soma total de até **50 MB** em "Juntar PDFs").
  - Quantidade máxima em "Juntar PDFs": **15 arquivos** por operação.
  - Quantidade máxima de páginas para renderização em lote de imagens/OCR no navegador: **50 páginas** por operação (com aviso claro quando excedido).
  - Imagens em "Imagens para PDF": até **20 imagens** por operação, totalizando até **30 MB**.

### 2.2 Evolução Futura (Fora do Escopo Atual)
- Fica registrado apenas como visão futura de monetização (plano pago mensal, **não implementado nem prometido nesta versão**):
  - Processamento e download em lote de múltiplos arquivos independentes (ex.: gerar vários PDFs/ZIPs de uma vez ou processar arquivos acima dos limites locais).
  - Experiência sem anúncios (integrada à prop `disabled` já preparada no componente `<AdSlot />` de `@agiliza/ui`).
  - Cotas dedicadas para futuras ferramentas que exijam backend pago (conversões Office #47 e IA para PDF #48).
- As funções de manipulação de PDF devem ser escritas como módulos puros em `apps/agiliza-pdf/lib/` desacoplados dos componentes React, facilitando testes determinísticos e eventual evolução futura.

---

## 3. Arquitetura Client-Side e Lições Aprendidas

### 3.1 Pilha Técnica Prevista (Fase 1)
- **Manipulação estrutural de PDF:** `pdf-lib` (juntar, dividir, extrair, girar, remover, inserir texto/imagens/assinaturas, números de página, marca d'água, recortar, achatar formulários).
- **Renderização e extração de texto:** `pdfjs-dist` (miniaturas, prévia de páginas, exportação para PNG/JPG via Canvas API, extração de texto e comparação visual/textual), com worker configurado de forma compatível com Next.js 16 (App Router) e deploy na Vercel.
- **OCR local (Issue #46):** `tesseract.js` carregado sob demanda (`dynamic import`) apenas quando o usuário abrir a aba de OCR, evitando aumentar o bundle inicial das demais ferramentas.
- **Scanner (Issue #46):** `navigator.mediaDevices.getUserMedia` com fallback de upload de foto no mobile e recorte/ajuste via Canvas.

### 3.2 Prevenção de Problemas Conhecidos (Lições do `agiliza-nota`)
- **Tailwind CSS v4 obrigatório:** `apps/agiliza-pdf/app/globals.css` deve conter `@import "tailwindcss";` e diretivas `@source` apontando para o app e `packages/ui`, evitando tela sem estilização.
- **Tema claro como padrão:** `apps/agiliza-pdf/app/layout.tsx` deve iniciar com `className="light" data-theme="light"`, mantendo consistência com `apps/web` e `apps/agiliza-nota`.
- **Separação de testes (Jest vs. Node test runner):** módulos puros em `apps/agiliza-pdf/lib/*.ts` que dependem de pacotes ESM modernos podem ser validados com `node --test` (com `"allowImportingTsExtensions": true` quando necessário), enquanto testes de componentes React no Jest (`components/*.test.tsx`) mockam a camada `lib/` para evitar falhas de transformação ESM no CI.
- **Conteúdo útil por ferramenta:** incluir seções objetivas de "Como usar", "Perguntas frequentes" e `<AdSlot />` (desligado por padrão via variável de ambiente) desde a estruturação base (#39).

---

## 4. Fluxos Funcionais Detalhados (Client-Side)

### 4.1 Organizar PDF (#40)
- **Juntar PDFs:** selecionar de 2 a 15 arquivos `.pdf`, reordenar a lista (botões acessíveis de subir/descer e remoção individual), visualizar contagem de páginas e baixar 1 arquivo `agiliza-pdf-unido.pdf`.
- **Dividir e Extrair Páginas:** carregar 1 `.pdf`, informar intervalos (ex.: `1-3, 5, 8-10`) ou escolher páginas visualmente e baixar 1 arquivo `.pdf` contendo apenas a seleção.
- **Girar e Remover Páginas:** carregar 1 `.pdf`, girar páginas em 90°, 180° ou 270°, marcar páginas para remoção e baixar o novo `.pdf`.

### 4.2 Converter de PDF (#41)
- **PDF para JPG / PNG:** carregar 1 `.pdf`, selecionar formato (`PNG` ou `JPG`), qualidade/escala e página específica (ou sequência controlada dentro do limite), renderizar via `pdfjs-dist` + Canvas e baixar a imagem gerada.
- **Extrair Texto (`.txt`):** extrair a camada textual de cada página preservando separação por página, permitindo copiar para a área de transferência ou baixar `.txt`.

### 4.3 Converter em PDF (#42)
- **Imagens para PDF:** carregar imagens `JPG`, `PNG` ou `WebP`, reordenar, escolher orientação (Retrato/Paisagem) e margem (Sem margem, Pequena, Média), e baixar 1 `.pdf`.
- **Texto para PDF:** colar texto ou enviar `.txt`/`.md`, configurar tamanho de fonte/margem e gerar `.pdf` multipágina com quebra automática de linhas.

### 4.4 Assinar PDF (#43)
- **Modos de assinatura visual:** desenhar no canvas (mouse ou toque), digitar nome com seleção de estilo tipográfico ou enviar imagem PNG com fundo transparente.
- **Posicionamento:** selecionar a página desejada, ajustar posição (X/Y) e escala sobre a prévia renderizada da página, e baixar o PDF assinado.
- **Transparência obrigatória:** exibir aviso claro informando que se trata de **assinatura visual gráfica**, sem certificado digital criptográfico ICP-Brasil.

### 4.5 Edição Avançada no Cliente (#45)
- Inserir números de página (posição e formato), marca d'água (texto/imagem com opacidade e rotação), recortar margens (`CropBox`), achatar formulários/anotações, preencher campos AcroForm existentes, adicionar anotações de texto simples, ocultar/tarjar áreas (rasterizando a página afetada para impedir recuperação do texto sob a tarja) e comparar dois PDFs (diferenças de texto e comparação visual lado a lado).

### 4.6 Segurança, Conversores Extras, Scanner e OCR (#46)
- Proteger PDF com senha e desbloquear PDF (mediante senha conhecida pelo usuário), converter HTML/CSV em PDF, exportar PDF para Markdown estruturado, escanear documentos pela câmera com ajuste de contraste/recorte e executar OCR client-side (`tesseract.js`) para PDFs escaneados.

### 4.7 Otimizar / Comprimir PDF (#44)
- Recompactação client-side com dois modos transparentes:
  - **Otimização estrutural (sem perda de texto):** reescrita limpa com remoção de metadados redundantes e compressão de streams.
  - **Compressão forte (rasterização controlada):** reamostragem das páginas em JPEG com qualidade configurável, exibindo aviso explícito de que o texto deixa de ser selecionável nesse modo.
- Exibir tamanho original, tamanho final e percentual real economizado (nunca exibir percentuais fixos inventados).

---

## 5. O Que NÃO É Viável com Fidelidade 100% Client-Side

Para evitar promessas falsas ou resultados quebrados, os itens abaixo **não** devem ser implementados como gambiarras no navegador e exigem backend dedicado (documentados nos Spikes #47 e #48):
- **Conversão fiel de Office para PDF e PDF para Office editável:** `Word (.docx)`, `Excel (.xlsx)`, `PowerPoint (.pptx)`, `ODT`, `RTF`, `EPUB` e `Pages` exigem motor completo de renderização/layout (ex.: LibreOffice headless em container Docker, Spike #47).
- **Conformidade estrita PDF/A e Reparo profundo de PDF corrompido:** exigem validação de perfis ISO e reconstrução de tabela XREF com ferramentas nativas como Ghostscript/qpdf (Spike #47).
- **Recursos de IA para PDF:** `Resumir com IA`, `Chat com PDF`, `Traduzir PDF` e `Gerar questões` exigem chamadas a API de LLM com autenticação, controle de custo e limite de tokens no servidor (Spike #48).

---

## 6. Casos de Erro e Bordas

- **PDF protegido por senha:** detectar na leitura e exibir mensagem orientativa clara sem travar a interface (na ferramenta de desbloqueio #46, solicitar a senha do usuário).
- **Arquivo corrompido ou extensão falsa:** validar assinatura mágica (`%PDF-`) e capturar exceções de parse exibindo erro legível ao usuário.
- **PDF escaneado sem camada de texto:** na extração de texto (#41), informar claramente que o documento aparenta ser uma imagem escaneada e direcionar para a funcionalidade de OCR (#46) quando disponível.
- **Arquivo acima do limite de tamanho ou páginas:** rejeitar antes de carregar tudo em memória, explicando o limite seguro do navegador.
- **Compressão sem redução de tamanho:** quando o PDF original já estiver altamente otimizado e o resultado ficar igual ou maior, informar o usuário com honestidade e não forçar um arquivo maior.
- **Confusão sobre validade jurídica da assinatura:** diferenciar visualmente e textualmente assinatura visual gráfica de assinatura digital ICP-Brasil.

---

## 7. Privacidade, Fluxo de Dados e Avisos Legais

- **Privacidade:** todas as operações da Fase 1 (#39 a #46) executam exclusivamente na memória do navegador do usuário, sem upload de arquivos para servidores da Rede Agiliza.
- **Transparência futura:** quando as fases de backend (#47) ou IA (#48) forem implementadas, os termos e a política de privacidade em `apps/web/app/privacidade/page.tsx` e `apps/web/app/termos/page.tsx` deverão ser atualizados previamente informando envio temporário e política de descarte imediato.
- **Aviso legal:** o usuário é responsável pela titularidade e autorização sobre os documentos processados. A ferramenta não realiza validação jurídica nem certificação digital ICP-Brasil.

---

## 8. Diretrizes de Interface (`AGENTS.md`)

Todas as implementações do `agiliza-pdf` devem seguir estritamente as regras confirmadas em `AGENTS.md`:
- Não usar gradientes roxos nem botões/selos em formato de pílula (`rounded-full`).
- Não usar emojis como ícones de interface (utilizar exclusivamente `Icon` de `@agiliza/ui`).
- Não usar travessões nos textos visíveis do produto.
- Não exibir métricas inventadas, avaliações fictícias ou contadores falsos.
- Garantir navegação por teclado, `<label htmlFor>` em todos os campos e feedback acessível (`role="status"` / `aria-live="polite"`).
