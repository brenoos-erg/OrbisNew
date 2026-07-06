const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const schema = read('prisma/schema.prisma')
const route = read('src/app/api/sst/plano-de-acao/route.ts')
const client = read('src/app/dashboard/sst/planos-de-acao/PlanosDeAcaoClient.tsx')

assert.match(
  schema,
  /model NonConformityActionItem \{[\s\S]*descricao\s+String\s+@db\.LongText/,
  'NonConformityActionItem.descricao deve ser LongText',
)
assert.match(
  route,
  /if \(!descricao\) \{[\s\S]*Descrição é obrigatória\./,
  'POST /api/sst/plano-de-acao deve validar descrição obrigatória',
)
assert.match(
  route,
  /getValueTooLongMessage\(error\)[\s\S]*status: 400/,
  'POST /api/sst/plano-de-acao deve retornar erro claro para valor muito longo',
)
assert.match(
  route,
  /try \{[\s\S]*notifyActionItemUpdate\(created\.id, 'STANDALONE_ACTION_CREATED'\)[\s\S]*catch \(notificationError\)/,
  'falha de notificação não deve impedir PA já criado',
)
assert.match(
  client,
  /setCreateError\(e\?\.message \|\| 'Erro ao registrar ação\.'\)/,
  'front deve exibir mensagem de erro retornada pela API no modal',
)
assert.match(
  client,
  /className="app-input w-full min-h-32 resize-y"/,
  'textarea da descrição deve ocupar largura total',
)
assert.match(
  client,
  /<button type="submit" disabled=\{creating\}/,
  'botão Registrar deve continuar desabilitado durante envio',
)

console.log('sst action plan long description regression ok')
