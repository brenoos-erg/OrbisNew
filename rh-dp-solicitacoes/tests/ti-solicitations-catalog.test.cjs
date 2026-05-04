const assert = require('node:assert/strict')
const fs = require('node:fs')

const seedSource = fs.readFileSync('prisma/seed.ts', 'utf8')
for (const code of ['RQ.TI.001', 'RQ.TI.002', 'RQ.TI.003', 'RQ.TI.004', 'RQ.TI.005', 'RQ.TI.006', 'RQ.TI.007']) {
  assert.match(seedSource, new RegExp(code.replace(/\./g, '\\.'), 'g'), `${code} deve existir no seed`)
}

assert.match(seedSource, /departamentos:\s*\[tiDepartment\.id\]/)
assert.doesNotMatch(seedSource, /RQ_TI_MANUTENCAO/)
assert.doesNotMatch(seedSource, /RQ_TI_ACESSO_SISTEMA/)
assert.match(seedSource, /VPN\/Acesso remoto/)
assert.match(seedSource, /Wi-Fi/)
assert.match(seedSource, /Erro\/Bug/)
assert.match(seedSource, /Nova funcionalidade/)

assert.match(seedSource, /Equipamento solicitado/)
assert.match(seedSource, /\['Notebook', 'Desktop', 'Celular', 'Impressora', 'Periféricos', 'Outro'\]/)
assert.doesNotMatch(seedSource, /'Monitor'/)
assert.match(seedSource, /Acessórios necessários/)
assert.match(seedSource, /Mochila/)
assert.match(seedSource, /Adaptador HDMI\/VGA\/USB-C/)
assert.doesNotMatch(seedSource, /Monitor adicional/)
assert.match(seedSource, /Solicitação de monitor deve ser aberta no tipo específico de monitor, quando aplicável\./)
assert.match(seedSource, /sistemas, programas, pastas de rede, e-mails, grupos ou acessos/)
assert.match(seedSource, /obrigatório quando selecionar Periféricos/)
assert.match(seedSource, /obrigatório quando selecionar Outro/)

const routeSource = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
assert.match(routeSource, /resolveTiRequiresApprovalByPayload/)
assert.match(routeSource, /computeTiDueDate/)

const tiRouteSource = fs.readFileSync('src/app/api/solicitacoes/ti/route.ts', 'utf8')
assert.match(tiRouteSource, /canAccessTiOperationalPanel/)
assert.match(tiRouteSource, /Ação executada: \$\{action\}/)
assert.match(tiRouteSource, /rows:\s*rows\.map/)

console.log('✅ ti-solicitations-catalog.test passed')
