const assert = require('node:assert/strict')
const fs = require('node:fs')

const page = fs.readFileSync('src/app/dashboard/controle-documentos/notificacoes/page.tsx', 'utf8')
const panel = fs.readFileSync('src/app/dashboard/controle-documentos/notificacoes/DocumentNotificationsPanel.tsx', 'utf8')

assert.match(page, /isAdmin/)
assert.match(page, /redirect\('\/dashboard\/controle-documentos\/publicados\?forbidden=document-notifications'\)/)
assert.match(panel, /Central de Notificações de Documentos/)
assert.match(panel, /Mapa do fluxo por tipo documental/)
assert.match(panel, /Destinatários/)
assert.match(panel, /Template/)
assert.match(panel, /Prévia/)
assert.match(panel, /Histórico/)
assert.match(panel, /Departamento responsável/)
assert.match(panel, /Centro de custo responsável/)
assert.match(panel, /Distribuição/)

console.info('document-notification-screen-regression.test.cjs: ok')
