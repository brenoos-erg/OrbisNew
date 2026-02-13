# Fluxo de termo + DocuSign (embedded signing)

## Visão geral
1. TI aloca equipamento via action `ALOCAR_E_GERAR_TERMO`.
2. Backend gera o PDF do termo automaticamente com template Handlebars + Playwright.
3. PDF é salvo em storage local (`/public/generated`) e também enviado em buffer para DocuSign.
4. Sistema cria envelope + recipient view URL (embedded signing) e salva em `DocumentAssignment`.
5. Usuário assina via DocuSign e o Connect webhook (`/api/webhooks/docusign`) marca como assinado.
6. Webhook baixa o Certificate of Completion, salva o arquivo, calcula SHA-256 e persiste como evidência.

## Configuração DocuSign
Preencha variáveis no `.env` com base em `.env.example`:
- `DOCUSIGN_OAUTH_BASE_PATH`: `account-d.docusign.com` (demo) ou `account.docusign.com` (prod).
- `DOCUSIGN_BASE_PATH`: `https://demo.docusign.net/restapi` (demo) ou base prod.
- `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_CLIENT_ID`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`.
- `APP_BASE_URL` para compor return URL do embedded signing.
- `DOCUSIGN_CONNECT_HMAC_SECRET` para validar webhook Connect.

## Configuração do Connect webhook
- URL: `POST {APP_BASE_URL}/api/webhooks/docusign`
- Eventos recomendados: envelope `completed`, `declined`, `voided`.
- Ative HMAC no Connect e configure a mesma chave em `DOCUSIGN_CONNECT_HMAC_SECRET`.

## Evidências jurídicas
Quando o envelope chega como `completed`:
- assignment é atualizado para `ASSINADO`.
- certificate de conclusão é baixado da API DocuSign.
- arquivo do certificate é salvo em storage e gravado em `auditTrailUrl`.
- hash SHA-256 do certificate é salvo em `auditTrailHash`.

## Compatibilidade
- A ação legada `ALOCAR` continua suportada (exige `pdfUrl`).
- Endpoint interno `/api/meus-documentos/[assignmentId]/assinar` bloqueia assinatura de documentos DocuSign, exceto se `ALLOW_INTERNAL_SIGNATURE=true`.

## Dependências para geração automática de PDF
- O backend usa `handlebars` + `playwright` para renderizar o termo em PDF no fluxo `ALOCAR_E_GERAR_TERMO`.
- O projeto possui `postinstall` para instalar o browser Chromium automaticamente: `playwright install chromium`.
- Instalação manual (quando necessário):
  - macOS/Linux: `npx playwright install chromium`
  - Windows (PowerShell): `npx playwright install chromium`
- Se o Playwright não estiver disponível no runtime, o endpoint retorna erro 422 com mensagem instrutiva para instalação.