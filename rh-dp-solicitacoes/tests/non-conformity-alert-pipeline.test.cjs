const assert = require('node:assert/strict')
const fs = require('node:fs')

const routeFile = fs.readFileSync('src/app/api/sst/nao-conformidades/route.ts', 'utf8')
assert.match(routeFile, /const notificationResult = await notifyNonConformityStakeholders\(/)
assert.match(routeFile, /console\.warn\('NC notification not sent'/)

console.log('non-conformity-alert-pipeline ok')