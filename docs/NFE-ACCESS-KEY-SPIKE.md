# Spike Técnico: Obtenção de XML/Dados de NF-e por Chave de Acesso (44 Dígitos)

> Issue #25 — Decisão arquitetural para `apps/agiliza-nota`.

---

## 1. Problema

O usuário do `agiliza-nota` precisa gerar o DANFE em PDF a partir de:
1. Um arquivo `.xml` de NF-e/NFC-e enviado pelo navegador; ou
2. Uma **chave de acesso de 44 dígitos**.

Enquanto o processamento do arquivo `.xml` pode ser 100% local (client-side), obter o XML completo apenas a partir da chave de 44 dígitos exige avaliar restrições técnicas, jurídicas e de custo da infraestrutura fiscal brasileira (SEFAZ).

---

## 2. Estrutura e Validação da Chave de Acesso (44 Dígitos)

Conforme o Manual de Orientação do Contribuinte (MOC NF-e), a chave numérica de 44 dígitos possui a seguinte estrutura fixa:

| Posição (0-based) | Tamanho | Campo | Descrição |
|---|---|---|---|
| `0..1` | 2 | `cUF` | Código IBGE da UF do emitente (ex.: `35` = SP, `23` = CE, `33` = RJ) |
| `2..5` | 4 | `AAMM` | Ano (2 dígitos) e mês (`01`..`12`) de emissão |
| `6..19` | 14 | `CNPJ` | CNPJ do emitente |
| `20..21` | 2 | `mod` | Modelo do documento fiscal (`55` = NF-e, `65` = NFC-e) |
| `22..24` | 3 | `serie` | Série da nota fiscal (`000`..`999`) |
| `25..33` | 9 | `nNF` | Número da nota fiscal |
| `34` | 1 | `tpEmis` | Forma de emissão (`1` = Normal, `2`..`9` = Contingência) |
| `35..42` | 8 | `cNF` | Código numérico aleatório da chave |
| `43` | 1 | `cDV` | Dígito verificador (módulo 11) |

### Algoritmo do Dígito Verificador (Módulo 11)
1. Percorrer os 43 primeiros dígitos da direita para a esquerda aplicando pesos cíclicos `2, 3, 4, 5, 6, 7, 8, 9`.
2. Somar os produtos e calcular `resto = soma % 11`.
3. Se `resto === 0` ou `resto === 1`, então `dv = 0`; caso contrário, `dv = 11 - resto`.
4. A chave é matematicamente válida se e somente se `Number(chave[43]) === dv`, `cUF` pertencer à tabela IBGE válida, `MM` estiver entre `01` e `12`, e `mod` for `55` ou `65`.

> **Importante:** essa validação comprova integridade estrutural e extrai metadados no navegador sem nenhum custo ou envio externo, mas **não** confirma autorização na SEFAZ nem retorna os itens/valores da nota.

---

## 3. Comparativo das Alternativas para Obter o XML pela Chave

| Alternativa | Viabilidade Técnica | Custo | Conformidade Legal / Segurança | Veredito |
|---|---|---|---|---|
| **A. Upload de XML + validação/decodificação local da chave** | 100% client-side, instantâneo, sem backend | R$ 0 | Total conformidade (dados não saem do navegador) | **Aprovada como fluxo padrão gratuito** |
| **B. API fiscal de terceiros via rota serverless (`/api/nfe/lookup`)** | Alta (retorna XML completo sob demanda) | Pago por consulta (ex.: planos por requisição) | Conforme, desde que provedor autorizado e documentado na Política de Privacidade | **Aprovada como integração opcional via env vars** |
| **C. SEFAZ Distribuição DF-e direta** | Requer certificado digital ICP-Brasil (A1/A3) do próprio destinatário/emitente | Custo do certificado + manutenção | Inviável para usuários anônimos sem certificado próprio | **Descartada para uso anônimo** |
| **D. Scraping / contorno de CAPTCHA em portais públicos** | Frágil e bloqueado por anti-bot | N/A | **Proibido** (viola termos de uso e políticas de segurança) | **Rejeitada permanentemente** |

---

## 4. Decisão Arquitetural Recomendada

Adotar uma **arquitetura em duas camadas** que entrega o produto gratuito imediatamente e suporta busca automática por chave assim que um provedor fiscal for contratado:

1. **Núcleo 100% Client-Side (sempre ativo, custo zero):**
   - Validação módulo 11 e decodificação imediata de qualquer chave de 44 dígitos (exibindo UF, mês/ano, CNPJ do emitente, modelo, série e número).
   - Upload de 1 arquivo `.xml` por vez no navegador, com parser estruturado e geração do DANFE em PDF sem servidor.
2. **Integração Opcional por Chave de Acesso (`POST /api/nfe/lookup`):**
   - Ativada **somente** quando as variáveis de ambiente `NFE_LOOKUP_API_URL` e `NFE_LOOKUP_API_KEY` estiverem configuradas na Vercel (nunca expostas no cliente).
   - **Contrato da rota:**
     - **Request:** `POST /api/nfe/lookup` com `{ "accessKey": "<44 dígitos>" }`
     - **Response (200):** `{ "xml": "<nfeProc>...</nfeProc>" }`
     - **Response (503 — não configurado):** `{ "code": "LOOKUP_NOT_CONFIGURED", "message": "Consulta automática por chave não configurada. Envie o arquivo XML da NF-e para gerar o DANFE." }`
     - **Response (400 / 404 / 429):** mensagens claras para chave inválida, nota não localizada ou limite de consultas excedido.
   - **Fallback transparente na UI:** se o provedor externo não estiver ativo (ou retornar `503`/`429`), a interface exibe os metadados decodificados da chave de 44 dígitos e orienta o usuário a enviar o arquivo `.xml` (disponível no e-mail da compra ou no portal oficial da SEFAZ) para gerar o DANFE em PDF na hora.
   - **Limite gratuito:** 1 consulta / 1 download de PDF por vez; rate-limit por IP obrigatório quando a API externa estiver habilitada.

---

## 5. Impacto em Privacidade e Termos de Uso

- **Enquanto a integração externa não estiver habilitada (`LOOKUP_NOT_CONFIGURED`):** nenhum dado sai do navegador; a política atual em `apps/web/app/privacidade/page.tsx` continua 100% fiel.
- **Se e quando `NFE_LOOKUP_API_URL` for ativada em produção:**
  - Atualizar `apps/web/app/privacidade/page.tsx` informando o nome do provedor fiscal contratado, que apenas a chave de 44 dígitos é enviada para consulta pontual e que o XML não é armazenado em banco de dados pela Rede Agiliza.
  - Atualizar `apps/web/app/termos/page.tsx` registrando limites de consulta e que o DANFE gerado é representação gráfica auxiliar.
