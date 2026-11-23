# Especificação Técnica e de Produto: AgilizaNota (`apps/agiliza-nota`)

> Documento de referência da evolução do `agiliza-nota` (Issue #23).
> URL de produção: `https://agiliza-nota.vercel.app`

---

## 1. Estado Atual vs. Escopo Planejado

Para evitar confusão entre o que já está publicado e o que será entregue nas próximas etapas, a tabela abaixo separa explicitamente cada funcionalidade:

| Funcionalidade | Estado atual no código | Issue de entrega |
|---|---|---|
| Formulário de Recibo de Pagamento + prévia HTML + impressão (`window.print()`) | Implementado | Refinado em #24 |
| Formulário de Declaração de Conteúdo + prévia HTML + impressão (`window.print()`) | Implementado | Refinado em #24 |
| Design System padronizado, acessibilidade (`htmlFor`), máscaras e validações inline | Planejado | #24 |
| Download direto de arquivo `.pdf` no cliente (Recibo e Declaração, 1 por vez) | Planejado | #26 |
| Spike de obtenção de dados/XML de NF-e por chave de acesso (44 dígitos) | Planejado | #25 |
| Aba NF-e/DANFE: upload de arquivo `.xml` (1 por vez) e validação módulo 11 da chave | Planejado | #27 |
| Prévia e geração de DANFE em PDF (Code 128 + A4 multipágina, 1 nota por vez) | Planejado | #28 |

---

## 2. Regras de Produto, Limites Gratuitos e Evolução Futura

### 2.1 Fase Atual (100% Gratuita)
- Todas as funcionalidades do `agiliza-nota` (e do restante da Rede Agiliza) são **100% gratuitas** nesta fase, sem cadastro obrigatório, sem paywall e sem anúncios implementados.
- **Limite operacional por ação:** processamento e download de **1 documento ou 1 nota fiscal (XML/DANFE) por vez**.
- Tentativas de enviar múltiplos arquivos `.xml` simultaneamente devem ser bloqueadas na interface com aviso claro explicando que o modo atual processa 1 nota por vez.

### 2.2 Evolução Futura (Fora do Escopo Atual)
- Fica registrado apenas como visão futura de monetização (plano pago mensal, **não implementado nem prometido nesta versão**):
  - Processamento e download em lote (múltiplas notas/documentos em uma única ação).
  - Experiência sem anúncios.
- A arquitetura do parser de XML e do gerador de PDF deve manter funções puras e desacopladas da interface para permitir futura reutilização em lote sem reescrever o núcleo de renderização.

---

## 3. Fluxos Funcionais Detalhados

### 3.1 Recibo de Pagamento
- **Entradas:** nome e CPF/CNPJ do emissor, nome e CPF/CNPJ do pagador, valor (R$), descrição/referente a, cidade/UF e data.
- **Validações:** valor numérico não negativo, máscaras de CPF/CNPJ e moeda BRL, indicação clara de campos obrigatórios antes de exportar.
- **Saída:** prévia A4 em tempo real, download de 1 arquivo `.pdf` (`recibo-pagamento.pdf`) no cliente (#26) e opção secundária de impressão via navegador.

### 3.2 Declaração de Conteúdo
- **Entradas:** dados do remetente, dados do destinatário, lista dinâmica de itens (descrição, quantidade, valor unitário) e local/data.
- **Validações:** quantidades e valores finitos e não negativos, soma automática do total declarado, tratamento seguro para lista vazia ou extensa.
- **Saída:** prévia A4 em tempo real, download de 1 arquivo `.pdf` (`declaracao-conteudo.pdf`) no cliente (#26) e opção secundária de impressão.

### 3.3 NF-e / DANFE (via XML ou Chave de Acesso de 44 Dígitos)
- **Entrada 1 (Upload de XML, 100% client-side):**
  - Aceita apenas **1 arquivo `.xml` por vez** (modelos `nfeProc` ou `NFe` no namespace padrão `http://www.portalfiscal.inf.br/nfe`), com limite seguro de tamanho (ex.: até 5 MB) para evitar travamento da aba.
  - Extrai no navegador: chave de acesso, protocolo de autorização (`protNFe`), natureza da operação, data de emissão, emitente, destinatário, itens/produtos, totais e impostos, transporte e informações complementares.
- **Entrada 2 (Chave de Acesso de 44 Dígitos):**
  - Validação e decodificação imediata no cliente: verificação de 44 dígitos numéricos, dígito verificador (módulo 11) e extração de metadados (UF, AAMM, CNPJ do emitente, modelo 55/65, série e número).
  - A forma de obtenção do XML completo apenas pela chave (integração externa autorizada vs. fallback orientando o envio do XML) será definida no **Spike #25**, descartando qualquer contorno de CAPTCHA ou scraping não autorizado.
- **Saída (#28):**
  - Prévia estruturada do DANFE na interface e download direto de 1 arquivo `.pdf` (`danfe-<numero-ou-chave>.pdf`) contendo código de barras Code 128 da chave de 44 dígitos, blocos oficiais do DANFE e paginação automática para notas com muitos itens.

---

## 4. Estados de Erro e Casos de Borda

- **XML inválido ou corrompido:** exibir erro legível sem travar a interface (ex.: arquivo não-XML, sintaxe quebrada ou documento que não corresponde a NF-e/NFC-e).
- **XML sem protocolo de autorização (`protNFe`):** permitir a visualização/geração com aviso explícito na prévia e no PDF de que a nota não possui protocolo de autorização anexado.
- **Múltiplos arquivos selecionados:** rejeitar o lote e informar que a versão gratuita processa 1 nota por vez.
- **Chave de acesso inválida:** apontar erro de quantidade de dígitos ou dígito verificador incorreto antes de qualquer consulta.
- **Indisponibilidade de serviço externo (se adotado em #25):** apresentar mensagem clara de indisponibilidade/limite e oferecer o envio direto do arquivo `.xml` como alternativa imediata.

---

## 5. Privacidade, Fluxo de Dados e Avisos Legais

- **Processamento client-side por padrão:** Recibos, Declarações de Conteúdo e conversão de arquivos `.xml` em DANFE PDF ocorrem exclusivamente na memória do navegador, sem envio de documentos a servidores da Rede Agiliza.
- **Consulta externa por chave (condicional ao Spike #25):** caso venha a existir chamada a uma API fiscal externa para resolver a chave de 44 dígitos, a chave trafegará apenas para essa consulta pontual e o fluxo deverá ser documentado em `apps/web/app/privacidade/page.tsx` e `apps/web/app/termos/page.tsx` antes da publicação.
- **Aviso legal obrigatório na interface e no rodapé do documento:**
  - Os recibos e declarações gerados são modelos auxiliares preenchidos sob responsabilidade exclusiva do emitente.
  - O DANFE gerado em PDF é uma representação gráfica auxiliar para consulta e conferência, não substitui o arquivo XML fiscal oficial e não realiza emissão ou transmissão perante a SEFAZ.

---

## 6. Diretrizes de Interface (`AGENTS.md`)

Todas as implementações do `agiliza-nota` devem seguir estritamente as regras confirmadas em `AGENTS.md`:
- Não usar gradientes roxos nem botões/selos em formato de pílula (`rounded-full`).
- Não usar emojis como ícones de interface (utilizar exclusivamente `Icon` de `@agiliza/ui`).
- Não usar travessões nos textos visíveis do produto.
- Manter navegação por teclado, `<label htmlFor>` em todos os campos e feedback acessível (`role="status"` / `aria-live="polite"`).
