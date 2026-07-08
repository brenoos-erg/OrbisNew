const assert = require('node:assert/strict')
const fs = require('node:fs')

const access = fs.readFileSync('src/lib/rhPositionsAccess.ts', 'utf8')
const api = fs.readFileSync('src/app/api/positions/route.ts', 'utf8')
const apiId = fs.readFileSync('src/app/api/positions/[id]/route.ts', 'utf8')
const preview = fs.readFileSync('src/app/api/positions/document-preview/route.ts', 'utf8')
const docs = fs.readFileSync('src/app/api/positions/[id]/documents/route.ts', 'utf8')
const download = fs.readFileSync('src/app/api/positions/[id]/documents/[documentId]/download/route.ts', 'utf8')
const page = fs.readFileSync('src/app/dashboard/rh/cargos/page.tsx', 'utf8')

assert.doesNotMatch(access, /role === ['"]ADMIN['"]/, 'ADMIN must not be allowed automatically')
assert.doesNotMatch(access, /canFeature/, 'manual feature permissions must not allow RH positions access')
assert.doesNotMatch(access, /FEATURE_KEYS\.RH\.CARGOS/, 'RH Cargos feature must not allow access automatically')
assert.doesNotMatch(access, /FEATURE_KEYS\.CONFIGURACOES\.CARGOS/, 'legacy Cargos feature must not allow access automatically')
assert.match(access, /return userHasRhAccess\(user\)/, 'access must be delegated to userHasRhAccess')

assert.match(api, /canAccessRhPositions\(user, Action\.VIEW\)/, 'GET /api/positions must check VIEW')
assert.match(api, /canAccessRhPositions\(user, Action\.CREATE\)/, 'POST /api/positions must check CREATE')
assert.match(api, /Acesso restrito ao departamento de Recursos Humanos\./, 'GET must return RH-only message')
assert.match(api, /Somente usuários do RH podem criar cargos\./, 'POST must return RH-only create message')

assert.match(apiId, /canAccessRhPositions\(user, Action\.VIEW\)/, 'GET detail must check VIEW')
assert.match(apiId, /canAccessRhPositions\(user, Action\.UPDATE\)/, 'PATCH must check UPDATE')
assert.match(apiId, /canAccessRhPositions\(user, Action\.DELETE\)/, 'DELETE must check DELETE')
assert.match(apiId, /Somente usuários do RH podem editar cargos\./, 'PATCH must return RH-only edit message')
assert.match(apiId, /Somente usuários do RH podem excluir cargos\./, 'DELETE must return RH-only delete message')

for (const [name, source] of [['preview', preview], ['docs', docs], ['download', download]]) {
  assert.match(source, /canAccessRhPositions/, `${name} route must use canAccessRhPositions`)
  assert.doesNotMatch(source, /administradores|Configurações nível 3|\['ADMIN', 'RH'\]/, `${name} route must not allow admin or legacy access`)
}

assert.match(page, /res\.status === 403/, 'RH cargos page must handle forbidden API responses')
assert.match(page, /Esta tela é exclusiva do departamento de Recursos Humanos\./, 'RH cargos page must show friendly forbidden message')

console.log('rh-positions-access-static.test.cjs passed')
