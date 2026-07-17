const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync(
  'src/app/api/documents/versions/[versionId]/cancel/route.ts',
  'utf8',
)

assert.match(route, /requireQualityDocumentManager\(me\.id\)/)
assert.match(route, /DocumentVersionStatus\.CANCELADO/)
assert.match(route, /operationalUseBlocked:\s*true/)
assert.match(route, /obsoleteAt:\s*new Date\(\)/)
assert.match(route, /obsoletedById:\s*me\.id/)
assert.match(route, /obsoleteReason:\s*reason/)
assert.match(route, /documentAuditLog\.create/)
assert.match(route, /action:\s*'CANCEL'/)
assert.match(route, /reason/)
assert.match(route, /prisma\.\$transaction/)

console.log('document-cancel-quality-audit-static ok')
