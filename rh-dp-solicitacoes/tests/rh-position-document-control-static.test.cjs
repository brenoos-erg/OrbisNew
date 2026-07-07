const assert = require('node:assert/strict')
const fs = require('node:fs')

const read = (p) => fs.readFileSync(p, 'utf8')
const fields = read('src/app/api/positions/positionFields.ts')
const api = read('src/app/api/positions/route.ts')
const apiId = read('src/app/api/positions/[id]/route.ts')
const storage = read('src/lib/positions/positionDocumentStorage.ts')
const modal = read('src/app/dashboard/rh/cargos/CargoFormModal.tsx')

assert.match(fields, /uploadedById: true/, 'PositionDocument select deve incluir uploadedById')
assert.match(fields, /uploadedBy: \{ select: \{ id: true, fullName: true, email: true \} \}/, 'PositionDocument select deve incluir uploadedBy')
assert.match(modal, /Documento vigente do cargo/, 'tela deve mostrar documento vigente do cargo')
assert.match(modal, /Histórico de versões/, 'tela deve mostrar histórico de versões')
for (const label of ['Código/Indexador', 'Revisão', 'Data do documento', 'Enviado por', 'Enviado em']) {
  assert.match(modal, new RegExp(label), `tela deve mostrar ${label}`)
}
assert.match(api + apiId + fields, /Já existe um cargo ativo com este código\/indexador\./, 'API deve validar duplicidade de indexador')
assert.match(fields, /findActivePositionWithSameIndexador/, 'validação de duplicidade deve consultar outro cargo ativo')
assert.match(apiId, /export async function DELETE/, 'DELETE de cargo deve continuar existindo')
assert.match(api + apiId, /attachPreviewedPositionDocument/, 'upload/importação deve continuar anexando documento')
assert.match(storage, /updateMany\(\{ where: \{ positionId \}, data: \{ isCurrent: false \} \}\)/, 'substituição deve marcar documento anterior como não vigente')
assert.match(storage, /latestDocumentId: document\.id/, 'substituição deve atualizar latestDocumentId')
assert.match(storage, /positionUpdateData/, 'substituição deve atualizar campos principais extraídos')
assert.match(modal, /Documento sem indexador identificado\. Informe o código manualmente\./, 'tela deve alertar documento sem indexador')

assert.match(modal, /Identificação do documento/, 'modal deve separar identificação do documento')
assert.match(modal, /Dados do cargo/, 'modal deve separar dados do cargo')
assert.match(modal, /Descrição e atividades/, 'modal deve separar descrição e atividades')
assert.match(modal, /Formação e requisitos/, 'modal deve separar formação e requisitos')
assert.match(modal, /Competências e responsabilidades/, 'modal deve separar competências e responsabilidades')
assert.match(modal, /Local de trabalho/, 'modal deve separar local de trabalho')

console.log('rh-position-document-control-static ok')
