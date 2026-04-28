const assert = require('node:assert/strict')
const fs = require('node:fs')

const mainRoute = fs.readFileSync('src/app/api/documents/notifications/route.ts', 'utf8')

assert.match(mainRoute, /requireNotificationAdmin\(Action\.VIEW\)/)
assert.match(mainRoute, /requireNotificationAdmin\(Action\.UPDATE\)/)
assert.match(mainRoute, /mode === 'preview'/)
assert.match(mainRoute, /mode === 'test'/)
assert.match(mainRoute, /status: 403/)
assert.match(mainRoute, /Sem permissão/)

console.info('document-notification-central-admin-api.test.cjs: ok')
