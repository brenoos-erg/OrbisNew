const assert = require('node:assert/strict')
const fs = require('node:fs')

const legacyList = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/page.tsx', 'utf8')
assert.match(legacyList, /redirect\('\/dashboard\/sgi\/qualidade\/nao-conformidades'\)/)

const legacyPlans = fs.readFileSync('src/app/dashboard/sst/planos-de-acao/page.tsx', 'utf8')
assert.match(legacyPlans, /redirect\('\/dashboard\/sgi\/qualidade\/planos-de-acao'\)/)

const sgiNova = fs.readFileSync('src/app/dashboard/sgi/qualidade/nao-conformidades/nova/page.tsx', 'utf8')
assert.match(sgiNova, /NovaNaoConformidadeClientPage/)

console.log('sgi-quality-legacy-redirects ok')