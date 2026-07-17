const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync(
  'src/app/api/documents/versions/[versionId]/original/route.ts',
  'utf8',
)
const viewPage = fs.readFileSync(
  'src/app/documents/view/[versionId]/page.tsx',
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

assert.match(viewPage, /requireQualityDocumentManager\(me\.id\)/)
assert.match(viewPage, /qualityAccess\.canManage/)
assert.match(viewPage, /Baixar documento original/)
assert.match(viewPage, /\/api\/documents\/versions\/\$\{encodeURIComponent\(versionId\)\}\/original/)

console.log('document-original-download-quality-static ok')
