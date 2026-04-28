const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/sst/nao-conformidades/[id]/route.ts', 'utf8')

assert.match(route, /let eventToNotify: NonConformityNotificationEvent \| null = null/)
assert.match(route, /if \(nextStatus && nextStatus !== current\.status\)/)
assert.doesNotMatch(route, /eventToNotify\s*=\s*'NC_UPDATED'[\s\S]*body\?\.descricao/)

console.log('non-conformity-update-notification-scope ok')
