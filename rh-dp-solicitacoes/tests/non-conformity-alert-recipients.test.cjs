const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationLib = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')
assert.match(notificationLib, /userModuleAccess\.findMany/)
assert.match(notificationLib, /QUALITY_MODULE_KEYS/)
assert.match(notificationLib, /key:\s*\{\s*in:/)
assert.match(notificationLib, /Falha no envio de alerta de NC/)

console.log('non-conformity-alert-recipients ok')