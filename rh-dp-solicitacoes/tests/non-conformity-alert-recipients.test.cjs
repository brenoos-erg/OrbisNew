const assert = require('node:assert/strict')
const fs = require('node:fs')

const notificationLib = fs.readFileSync('src/lib/sst/nonConformityNotifications.ts', 'utf8')
assert.match(notificationLib, /userModuleAccess\.findMany/)
assert.match(notificationLib, /module:\s*\{\s*\n\s*key:\s*'SST'/)
assert.match(notificationLib, /Falha no envio de alerta de NC/)

console.log('non-conformity-alert-recipients ok')