const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const schema = read('prisma/schema.prisma')
const positionModel = schema.match(/model Position \{[\s\S]*?\n\}/)?.[0] ?? ''
for (const field of ['description','mainActivities','complementaryActivities','requiredKnowledge','behavioralCompetencies','others','complexity','confidentialDataAccess','experience','schooling','course','courseInProgress','periodModule','workSchedule','workplace','sectorProject','enxoval','uniform']) {
  assert.match(positionModel, new RegExp(`${field}\\s+String\\?\\s+@db\\.LongText`), `${field} must be LongText`)
}
for (const field of ['name','indexador','revision','managerPosition','framing','areaSector','cbo','workPoint','site']) {
  assert.match(positionModel, new RegExp(`${field}\\s+String(\\?|\\s)`), `${field} must be a String field`)
  assert.doesNotMatch(positionModel, new RegExp(`${field}\\s+String\\?\\s+@db\\.LongText`), `${field} must not be LongText`)
}

const migration = read('prisma/migrations/202607020001_position_longtext_fields/migration.sql')
for (const field of ['description','mainActivities','complementaryActivities','requiredKnowledge','behavioralCompetencies','others','complexity','confidentialDataAccess','experience','schooling','course','courseInProgress','periodModule','workSchedule','workplace','sectorProject','enxoval','uniform']) {
  assert.match(migration, new RegExp('MODIFY COLUMN `'+field+'` LONGTEXT NULL'), `migration must alter ${field}`)
}

const positionFields = read('src/app/api/positions/positionFields.ts')
assert.match(positionFields, /const keys = \[\.\.\.textKeys, \.\.\.otherKeys\]/, 'positionDataFromBody should use allow-listed schema fields')
assert.match(positionFields, /trim\(\)/, 'positionDataFromBody should trim strings')
assert.match(positionFields, /trimmed === '' \? null/, 'positionDataFromBody should convert empty strings to null')
assert.match(positionFields, /Data do documento inválida\./, 'positionDataFromBody should reject invalid documentDate')
assert.match(positionFields, /code !== 'P2000'/, 'P2000 helper should detect Prisma P2000')

const api = read('src/app/api/positions/route.ts')
assert.match(api, /Nome do cargo é obrigatório\./, 'POST must validate name')
assert.match(api, /getPrismaP2000Message\(error\)/, 'POST must handle P2000')
assert.match(api, /await requireActiveUser\(\)/, 'GET /api/positions must require an authenticated user')
assert.match(api, /canAccessRhPositions\(user, Action\.CREATE\)/, 'POST /api/positions must require CREATE permission')
assert.match(api, /Sem permissão para criar cargos\./, 'POST forbidden message must be clear')
assert.match(positionFields, /Já existe um cargo cadastrado com este nome\./, 'P2002 duplicate name must return a clear message')

const apiId = read('src/app/api/positions/[id]/route.ts')
assert.match(apiId, /canAccessRhPositions\(user, Action\.VIEW\)/, 'GET /api/positions/[id] must require VIEW permission')
assert.match(apiId, /canAccessRhPositions\(user, Action\.UPDATE\)/, 'PATCH /api/positions/[id] must require UPDATE permission')
assert.match(apiId, /canAccessRhPositions\(user, Action\.DELETE\)/, 'DELETE /api/positions/[id] must require DELETE permission')
assert.match(apiId, /Sem permissão para atualizar cargos\./, 'PATCH forbidden message must be clear')
assert.match(apiId, /Sem permissão para excluir cargos\./, 'DELETE forbidden message must be clear')

const sidebar = read('src/components/layout/Sidebar.tsx')
assert.match(sidebar, /RH/, 'Sidebar must render RH group')
assert.match(sidebar, /href="\/dashboard\/rh\/cargos"/, 'Sidebar RH Cargos must point to new route')
assert.doesNotMatch(sidebar, /href="\/dashboard\/configuracoes\/cargos"/, 'Sidebar must not link cargos under Configurações')

assert.ok(fs.existsSync(path.join(root, 'src/app/dashboard/rh/cargos/page.tsx')), 'new cargos list route must exist')
assert.ok(fs.existsSync(path.join(root, 'src/app/dashboard/rh/cargos/novo/page.tsx')), 'new cargos create route must exist')
assert.match(read('src/app/dashboard/configuracoes/cargos/page.tsx'), /redirect\('\/dashboard\/rh\/cargos'\)/)
assert.match(read('src/app/dashboard/configuracoes/cargos/novo/page.tsx'), /redirect\('\/dashboard\/rh\/cargos\/novo'\)/)

const access = read('src/lib/rhPositionsAccess.ts')
assert.match(access, /role === 'ADMIN'/, 'ADMIN must access RH positions')
assert.match(access, /FEATURE_KEYS\.RH\.CARGOS/, 'RH.CARGOS permission must access RH positions')
assert.match(access, /FEATURE_KEYS\.CONFIGURACOES\.CARGOS/, 'legacy CONFIGURACOES.CARGOS permission must access RH positions')
assert.match(access, /userHasRhAccess/, 'RH access fallback must be preserved')

const rq063 = read('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx')
assert.doesNotMatch(rq063, /fetch\('\/api\/positions/, 'RQ_063 must not require /api/positions to submit personnel requests')
assert.match(rq063, /Informe o cargo solicitado/, 'RQ_063 must ask for a free-text requested position')

console.log('rh-positions-static.test.cjs passed')
