const fs = require('fs')
const assert = require('assert')

const listSource = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const externalAdmissionSource = fs.readFileSync('src/lib/externalAdmission.ts', 'utf8')

assert.doesNotMatch(
  listSource,
  /mode:\s*['"]insensitive['"]/,
  'GET /api/solicitacoes não pode usar mode: insensitive em filtros contains.',
)
assert.match(
  listSource,
  /where\.protocolo = \{\s*\n\s*contains: protocolo,\s*\n\s*\}/,
  'Filtro por protocolo deve continuar ativo em buildWhereFromSearchParams.',
)
assert.match(
  listSource,
  /Object\.assign\(payload, patchExternalAdmissionPayloadSeed\(payload\)\)/,
  'Criação de solicitação deve preparar seed estrutural para admissão externa quando aplicável.',
)

assert.match(
  externalAdmissionSource,
  /candidateAccess:\s*\{\s*\n\s*mode: 'TOKEN_LINK',/,
  'Seed de admissão externa deve prever acesso por link/token para candidato sem acesso interno.',
)
assert.match(
  externalAdmissionSource,
  /checklist:\s*\{\s*\n\s*status: 'PENDING',/,
  'Seed de admissão externa deve prever checklist documental obrigatório.',
)
assert.match(
  externalAdmissionSource,
  /triage:\s*\{\s*\n\s*status: 'PENDING_RH',/,
  'Seed de admissão externa deve prever triagem/conferência pelo RH.',
)

console.log('✅ solicitacoes-list-and-external-admission-regression.test passed')
