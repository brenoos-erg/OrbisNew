const assert = require('node:assert')
const fs = require('node:fs')

const seed = fs.readFileSync('prisma/seed.ts', 'utf8')
const createRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const approveRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/aprovar/route.ts', 'utf8')

const epiSchemaMatch = seed.match(/const requisicaoEpiUniformesSchema = \{[\s\S]*?\n    \}/)
assert(epiSchemaMatch, 'seed deve declarar schema da RQ.SST.043')
const epiSchema = epiSchemaMatch[0]

assert.match(epiSchema, /departamentos:\s*\[sstDepartment\.id\]/, 'RQ.SST.043 deve nascer no departamento 19/SST')
assert.match(epiSchema, /requiresApproval:\s*false/, 'RQ.SST.043 deve nascer sem aprovação obrigatória')
assert.doesNotMatch(epiSchema, /SERVIÇOS DE LOGÍSTICA|centroResponsavelLabel:\s*'LOGÍSTICA'|destinoAposAprovacao/, 'RQ.SST.043 não deve apontar categoria/destino/centro responsável para Logística')

assert.match(createRoute, /const isSolicitacaoEpi = isSolicitacaoEpiUniforme\(tipo\)/, 'criação deve identificar RQ.SST.043')
assert.match(createRoute, /sstDepartment[\s\S]*code: '19'[\s\S]*departmentId: initialDepartmentId/, 'criação deve forçar departamento inicial SST para EPI')

assert.match(approveRoute, /else if \(isVeiculos && logisticaDepartment\) \{\s*updateData\.departmentId = logisticaDepartment\.id\s*\}/, 'veículos devem continuar sendo encaminhados para Logística após aprovação')
assert.doesNotMatch(approveRoute, /\(isVeiculos \|\| isSolicitacaoEpi\) && logisticaDepartment/, 'EPI não deve compartilhar regra logística de veículos')
assert.doesNotMatch(approveRoute, /ENCAMINHADA_LOGISTICA/, 'EPI não deve registrar timeline ENCAMINHADA_LOGISTICA')
assert.doesNotMatch(approveRoute, /Solicitação de EPI aprovada e encaminhada para \$\{logisticaDepartment\.name\}/, 'EPI aprovada não deve ser encaminhada automaticamente para Logística')

console.log('epi-logistics-routing-regression ok')
