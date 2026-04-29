const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationSource = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')
const actionPlanSource = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/plano-de-acao/route.ts', 'utf8')

assert.match(notificationSource, /CONFIGURED_RECIPIENT_ALLOWED_EVENTS/)
assert.match(notificationSource, /'NC_CREATED', 'NC_UPDATED'/)
assert.match(notificationSource, /Role\.ADMIN/)
assert.match(actionPlanSource, /sem notificação automática por ausência de usuário vinculado/)

console.log('non-conformity-configured-recipients-guard ok')
