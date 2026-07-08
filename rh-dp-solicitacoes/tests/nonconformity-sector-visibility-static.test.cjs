const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const listRoute = read('src/app/api/sst/nao-conformidades/route.ts')
const detailRoute = read('src/app/api/sst/nao-conformidades/[id]/route.ts')
const accessLib = read('src/lib/sst/nonConformityAccess.ts')

const getFunctionBody = (source, name) => {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `função ${name} deve existir`)
  const braceStart = source.indexOf('{', start)
  let depth = 0
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(braceStart + 1, index)
  }
  throw new Error(`não foi possível localizar corpo da função ${name}`)
}

const listGet = getFunctionBody(listRoute, 'GET')
const detailGet = detailRoute.match(/export async function GET[\s\S]*?export async function PATCH/)?.[0] ?? ''
const detailPatch = detailRoute.match(/export async function PATCH[\s\S]*/)?.[0] ?? ''
const sectorFunction = getFunctionBody(accessLib, 'getUserSectorCostCenterIds')

assert.match(
  listRoute,
  /import \{ getUserSectorCostCenterIds \} from '@\/lib\/sst\/nonConformityAccess'/,
  'listagem deve importar getUserSectorCostCenterIds',
)
assert.doesNotMatch(listGet, /getUserCostCenterIds\(me\.id\)/, 'GET da listagem não deve usar getUserCostCenterIds para visibilidade')
assert.match(listGet, /await getUserSectorCostCenterIds\(me\.id\)/, 'GET da listagem deve usar getUserSectorCostCenterIds')
assert.match(
  listGet,
  /!hasMinLevel\(level,\s*ModuleLevel\.NIVEL_2\)[\s\S]*await getUserSectorCostCenterIds\(me\.id\)[\s\S]*:\s*\[\]/,
  'nível 2 ou superior deve continuar sem filtro por centros de custo na listagem',
)

assert.match(
  detailRoute,
  /getUserSectorCostCenterIds/,
  'detalhe deve importar getUserSectorCostCenterIds',
)
assert.doesNotMatch(detailGet, /getUserCostCenterIds\(me\.id\)/, 'GET do detalhe não deve usar getUserCostCenterIds')
assert.match(detailGet, /await getUserSectorCostCenterIds\(me\.id\)/, 'GET do detalhe deve usar getUserSectorCostCenterIds')
assert.match(
  detailGet,
  /hasMinLevel\(level,\s*ModuleLevel\.NIVEL_2\)\s*\?\s*\[\]\s*:\s*await getUserSectorCostCenterIds\(me\.id\)/,
  'nível 2 ou superior deve continuar vendo qualquer NC no detalhe',
)
assert.doesNotMatch(detailPatch, /getUserCostCenterIds\(me\.id\)/, 'PATCH do detalhe não deve usar getUserCostCenterIds')
assert.match(detailPatch, /await getUserSectorCostCenterIds\(me\.id\)/, 'PATCH do detalhe deve usar getUserSectorCostCenterIds')
assert.match(
  detailPatch,
  /hasMinLevel\(level,\s*ModuleLevel\.NIVEL_2\)\s*\?\s*\[\]\s*:\s*await getUserSectorCostCenterIds\(me\.id\)/,
  'nível 2 ou superior deve continuar podendo tratar qualquer NC conforme regra atual',
)

assert.match(sectorFunction, /departmentId:\s*true/, 'getUserSectorCostCenterIds deve considerar user.departmentId')
assert.match(sectorFunction, /userDepartments:\s*\{\s*select:\s*\{\s*departmentId:\s*true\s*\}\s*\}/, 'getUserSectorCostCenterIds deve considerar user.userDepartments')
assert.match(sectorFunction, /db\.costCenter\.findMany\([\s\S]*where:\s*\{\s*departmentId:\s*\{\s*in:/, 'getUserSectorCostCenterIds deve buscar cost centers por departmentId')

console.log('nonconformity sector visibility static ok')
