const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationLib = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')

assert.doesNotMatch(notificationLib, /ALERTA_ENVOLVIDOS_/)
assert.match(notificationLib, /Notificação de abertura enviada para Qualidade/)
assert.match(notificationLib, /Notificação pós-aprovação enviada para centros envolvidos/)
assert.match(notificationLib, /Notificação de ação enviada ao responsável/)
assert.match(notificationLib, /Notificação de verificação enviada para Qualidade/)

console.log('non-conformity-notification-matrix ok')
