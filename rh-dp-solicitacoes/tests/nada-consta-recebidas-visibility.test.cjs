const assert = require('node:assert/strict')
require('ts-node/register/transpile-only')
const {
  normalizeSectorKey,
  isNadaConstaSolicitation,
  userCanSeeNadaConstaBySector,
} = require('../src/lib/solicitationVisibility')

assert.equal(normalizeSectorKey('  Saúde   Ocupacional '), 'saude ocupacional')
assert.equal(normalizeSectorKey('saude ocupacional'), 'saude ocupacional')
assert.equal(normalizeSectorKey('Segurança do Trabalho'), 'seguranca do trabalho')
assert.equal(normalizeSectorKey('SST'), 'seguranca do trabalho')
assert.equal(isNadaConstaSolicitation({ tipo: { nome: 'Solicitação de Nada Consta' } }), true)

const scopeSaude = {
  userDepartmentNamesNormalized: ['saude ocupacional'],
  userSectorNamesNormalized: ['saude ocupacional'],
  userCostCenterIds: [],
  userDepartmentIds: [],
}
assert.equal(userCanSeeNadaConstaBySector(scopeSaude, {
  tipo: { nome: 'Nada Consta' },
  solicitacaoSetores: [{ setor: 'Saúde Ocupacional' }],
}), true)

const scopeSst = {
  userDepartmentNamesNormalized: ['seguranca do trabalho'],
  userSectorNamesNormalized: ['seguranca do trabalho'],
  userCostCenterIds: [],
  userDepartmentIds: [],
}
assert.equal(userCanSeeNadaConstaBySector(scopeSst, {
  tipo: { nome: 'Nada Consta' },
  payload: { setoresResponsaveis: ['SST'] },
}), true)

const scopeTi = {
  userDepartmentNamesNormalized: ['tecnologia da informacao'],
  userSectorNamesNormalized: ['tecnologia da informacao'],
  userCostCenterIds: [],
  userDepartmentIds: [],
}
assert.equal(userCanSeeNadaConstaBySector(scopeTi, {
  tipo: { nome: 'Nada Consta' },
  payload: { setoresResponsaveis: ['Saúde Ocupacional'] },
}), false)

const receivedRouteSource = require('node:fs').readFileSync('src/app/api/solicitacoes/recebidas/route.ts','utf8')
assert.match(receivedRouteSource, /userCanSeeNadaConstaBySector/, 'API recebidas deve aplicar regra específica de Nada Consta por setor')
assert.match(receivedRouteSource, /total = hasInMemoryFilters \? filteredSolicitations.length : dbTotal/, 'count e list devem compartilhar a mesma base após pós-filtro')

console.log('nada-consta-recebidas-visibility ok')
