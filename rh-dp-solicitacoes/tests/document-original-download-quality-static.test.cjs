const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync(
  'src/app/api/documents/versions/[versionId]/original/route.ts',
  'utf8',
)

assert.match(route, /requireQualityDocumentManager\(me\.id\)/)
assert.match(route, /QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE/)
assert.match(route, /resolvePublicDocumentPath\(version\.fileUrl\)/)
assert.match(route, /prisma\.documentVersion\.findUnique/)
assert.match(route, /registerDocumentAuditLog/)
assert.match(route, /X-Document-Copy-Type': 'ORIGINAL'/)
assert.match(route, /Cache-Control': 'private, no-store, max-age=0'/)
assert.doesNotMatch(route, /prisma\.[a-zA-Z]+\.(update|delete|createMany|updateMany)\s*\(/)

console.log('document-original-download-quality-static ok')
