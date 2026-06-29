const assert = require('node:assert/strict')
const fs = require('node:fs')
function test(name, fn) { try { fn(); console.log(`✓ ${name}`) } catch (error) { console.error(`✗ ${name}`); throw error } }
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8')
const migration = fs.readFileSync('prisma/migrations/202606290001_iso9001_sgq_hardening/migration.sql', 'utf8')
const accessLib = fs.readFileSync('src/lib/access.ts', 'utf8')
const routing = fs.readFileSync('src/lib/iso-document-routing.ts', 'utf8')
const deleteRoute = fs.readFileSync('src/app/api/documents/[id]/route.ts', 'utf8')
const controlledAction = fs.readFileSync('src/lib/documents/controlledAction.ts', 'utf8')
const access = fs.readFileSync('src/lib/documentVersionAccess.ts', 'utf8')

test('getUserModuleLevel existe e está exportado', () => {
  assert.match(accessLib, /export async function getUserModuleLevel/)
})

test('schema mantém somente hardening documental desta etapa', () => {
  for (const removed of ['AuditPlan','ManagementReview','QualityPolicy','QualityObjective','QualityRisk','SupplierEvaluation','CustomerFeedback','Iso9001MatrixItem']) {
    assert.doesNotMatch(schema, new RegExp(`model ${removed}`))
    assert.doesNotMatch(migration, new RegExp('CREATE TABLE `'+removed+'`'))
  }
  assert.match(schema, /inactiveAt\s+DateTime\?/)
  assert.match(schema, /obsoleteAt\s+DateTime\?/)
  assert.match(schema, /copyNumber\s+String\s+@unique/)
})

test('publicação direta controlada sem fluxo é bloqueada com mensagem exigida', () => {
  assert.match(routing, /Tipo documental sem fluxo de aprovação configurado\./)
  assert.match(routing, /ModuleLevel\.NIVEL_3/)
  assert.match(routing, /directPublicationJustification/)
})

test('DELETE de documento ISO preserva histórico por cancelamento lógico', () => {
  assert.doesNotMatch(deleteRoute, /isoDocument\.delete/)
  assert.match(deleteRoute, /inactiveAt/)
  assert.match(deleteRoute, /DocumentVersionStatus\.CANCELADO/)
  assert.match(deleteRoute, /action: 'CANCEL'/)
})

test('cópia impressa registra tipo, número, validade e marca dágua', () => {
  assert.match(schema, /copyNumber\s+String\s+@unique/)
  assert.match(schema, /validUntil\s+DateTime\?/)
  assert.match(controlledAction, /CÓPIA NÃO CONTROLADA/)
  assert.match(controlledAction, /CÓPIA CONTROLADA/)
})

test('versão obsoleta bloqueia uso operacional para usuário não autorizado', () => {
  assert.match(access, /Versões obsoletas são apenas para consulta histórica autorizada/)
  assert.match(access, /operationalUseBlocked/)
})

test('migration evita default uuid e trata copyNumber de linhas existentes antes de NOT NULL', () => {
  assert.doesNotMatch(migration, /DEFAULT \(uuid\(\)\)/i)
  assert.match(migration, /ADD COLUMN `copyNumber` VARCHAR\(191\) NULL/)
  assert.match(migration, /UPDATE `PrintCopy`[\s\S]+SET `copyNumber` = CONCAT/)
  assert.match(migration, /MODIFY `copyNumber` VARCHAR\(191\) NOT NULL/)
})
