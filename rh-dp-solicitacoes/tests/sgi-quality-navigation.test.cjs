const assert = require('node:assert/strict')
const fs = require('node:fs')

const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8')
assert.match(sidebar, /SGI \/ Qualidade/)
assert.doesNotMatch(sidebar, /href="\/dashboard\/sst\/nao-conformidades"/)
assert.doesNotMatch(sidebar, /href="\/dashboard\/sst\/planos-de-acao"/)
assert.match(sidebar, /href="\/dashboard\/sgi\/qualidade\/nao-conformidades"/)
assert.match(sidebar, /href="\/dashboard\/sgi\/qualidade\/planos-de-acao"/)

const ncDetail = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/[id]/NaoConformidadeDetailClient.tsx', 'utf8')
assert.doesNotMatch(ncDetail, /Abrir Gestão de Mudanças/)
assert.doesNotMatch(ncDetail, /Gestão de Mudanças vinculada/)
assert.doesNotMatch(ncDetail, /Gest[aã]o de Mudanças/)

console.log('sgi-quality-navigation ok')