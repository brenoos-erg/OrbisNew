const assert = require('node:assert')
const fs = require('node:fs')

const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')
const route = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')

assert.match(
  page,
  /const\s+resolveRequestCostCenterId\s*=\s*\(camposValues:[\s\S]*?extras\.centroCustoForm[\s\S]*?solicitanteManual\.costCenterId[\s\S]*?me\?\.costCenterId[\s\S]*?null/,
  'nova/page.tsx deve resolver o centro de custo principal considerando extras.centroCustoForm antes do perfil do usuário.',
)

assert.match(
  page,
  /selectedTipo\?\.id\s*===\s*'RQ_063'\s*&&\s*!resolvedRequestCostCenterId[\s\S]*?Selecione o Centro de Custo da solicitação\./,
  'RQ_063 deve bloquear o envio antes do fetch quando o centro de custo da solicitação não foi selecionado.',
)

assert.match(
  page,
  /costCenterId:\s*resolvedRequestCostCenterId/,
  'nova/page.tsx deve enviar costCenterId no body do POST para /api/solicitacoes.',
)

assert.match(
  page,
  /buildCostCenterLabel\(resolvedRequestCostCenterId\)[\s\S]*?centroCustoIdLabel[\s\S]*?centroCustoFormLabel/,
  'nova/page.tsx deve preservar o label do centro de custo resolvido no payload.',
)

assert.match(
  route,
  /const\s+costCenterIdFromCampos\s*=[\s\S]*?campos\.centroCustoId[\s\S]*?campos\.centroCustoDestinoId[\s\S]*?campos\.centroCustoForm[\s\S]*?campos\.costCenterId[\s\S]*?campos\.contratoDestinoId[\s\S]*?null/,
  'route.ts deve aceitar fallback de campos.centroCustoId, campos.centroCustoForm e campos legados.',
)

assert.match(
  route,
  /const\s+resolvedCostCenterId\s*=[\s\S]*?costCenterId\s*\?\?[\s\S]*?costCenterIdFromCampos\s*\?\?[\s\S]*?me\.costCenterId\s*\?\?[\s\S]*?null/,
  'route.ts deve resolver costCenterId usando body, campos e perfil como fallback.',
)

assert.match(
  route,
  /Centro de custo é obrigatório\. Selecione o campo Centro de Custo da solicitação antes de enviar\./,
  'route.ts deve retornar mensagem clara quando o centro de custo continuar ausente.',
)

console.log('rq063-cost-center-submission ok')
