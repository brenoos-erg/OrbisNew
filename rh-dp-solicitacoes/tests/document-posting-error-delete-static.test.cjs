const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

function test(name, fn) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    throw error
  }
}

test('endpoint DELETE marca exclusão lógica por erro de postagem e libera o código', () => {
  const source = read('src/app/api/documents/[id]/route.ts')
  assert.match(source, /deletionType: POSTING_ERROR_MARKER/)
  assert.match(source, /codeReleased: true/)
  assert.match(source, /isoDocument\.update/)
  assert.match(source, /isActive: false/)
  assert.match(source, /activeCode: null/)
  assert.match(source, /inactiveAt: new Date/)
  assert.match(source, /inactiveById: ctx\.me\.id/)
  assert.match(source, /inactiveReason/)
  assert.match(source, /documentVersion\.updateMany/)
  assert.match(source, /isCurrentPublished: false/)
  assert.match(source, /operationalUseBlocked: true/)
  assert.match(source, /obsoleteAt: new Date/)
  assert.match(source, /obsoletedById: ctx\.me\.id/)
  assert.match(source, /obsoleteReason: inactiveReason/)
  assert.doesNotMatch(source, /isoDocument\.delete/)
  assert.doesNotMatch(source, /DocumentVersionStatus\.CANCELADO/)
})

test('UI separa cancelamento formal de exclusão por erro de postagem', () => {
  const source = read('src/components/documents/DocumentsGrid.tsx')
  assert.match(source, /Cancelar documento/)
  assert.match(source, /preservando rastreabilidade e histórico/)
  assert.match(source, /Excluir por erro de postagem/)
  assert.match(source, /libera o código para novo cadastro sem gerar nova revisão/)
  assert.match(source, /Motivo obrigatório da exclusão por erro de postagem/)
})

test('script de correção do RQ.ENG.196 existe em package.json', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.equal(
    packageJson.scripts['documents:fix-deleted-code'],
    'ts-node -r tsconfig-paths/register scripts/fix-deleted-document-code-availability.ts',
  )
})


test('code-availability ignora documentos marcados com POSTING_ERROR', () => {
  const source = read('src/app/api/documents/code-availability/route.ts')
  assert.match(source, /findMany/)
  assert.match(source, /activeDocument/)
  assert.match(source, /inactiveReason[\s\S]+POSTING_ERROR/)
  assert.match(source, /Código disponível para novo cadastro\. Documento anterior foi excluído por erro de postagem\./)
})

test('schema permite histórico inativo e protege unicidade de código ativo', () => {
  const schema = read('prisma/schema.prisma')
  assert.match(schema, /model IsoDocument[\s\S]+code\s+String(?:\s|$)/)
  assert.match(schema, /activeCode\s+String\?\s+@unique/)
  assert.doesNotMatch(schema, /model IsoDocument[\s\S]+code\s+String\s+@unique/)
  assert.match(schema, /@@index\(\[code\]\)/)
})

test('criação usa activeCode para bloquear dois documentos ativos com mesmo código', () => {
  const source = read('src/app/api/documents/route.ts')
  assert.match(source, /where: \{ activeCode: payload\.code \}/)
  assert.match(source, /activeCode: payload\.code/)
})

test('migration cria índice único em activeCode e preenche ativos existentes', () => {
  const migration = read('prisma/migrations/202607020002_add_iso_document_active_code/migration.sql')
  assert.match(migration, /ADD COLUMN `activeCode` VARCHAR\(191\) NULL/)
  assert.match(migration, /SET `activeCode` = `code`/)
  assert.match(migration, /WHERE `isActive` = true/)
  assert.match(migration, /CREATE UNIQUE INDEX `IsoDocument_activeCode_key`/)
})


test('POSTING_ERROR mantém status original e bloqueia uso operacional das versões', () => {
  const source = read('src/app/api/documents/[id]/route.ts')
  assert.match(source, /documentVersion\.updateMany/)
  assert.match(source, /operationalUseBlocked: true/)
  assert.match(source, /isCurrentPublished: false/)
  assert.doesNotMatch(source, /status:\s*DocumentVersionStatus\.CANCELADO/)
})

test('acesso bloqueia documento POSTING_ERROR para usuário comum e permite histórico autorizado', () => {
  const source = read('src/lib/documentVersionAccess.ts')
  assert.match(source, /Documento excluído por erro de postagem\. Disponível apenas para consulta histórica autorizada\./)
  assert.match(source, /isPostingErrorInactiveDocument/)
  assert.match(source, /me\.role === 'ADMIN' \|\| moduleAccess\?\.level === ModuleLevel\.NIVEL_3/)
  assert.match(source, /intent && isPostingErrorInactiveDocument\(version\.document\) && !canHistorical/)
})

test('listagens normais continuam filtrando documentos ativos', () => {
  const source = read('src/lib/iso-documents.ts')
  assert.match(source, /document:\s*\{[\s\S]+isActive: true/)
})
