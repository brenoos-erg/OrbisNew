const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/NaoConformidadesClient.tsx', 'utf8')

assert.match(source, /Data criação/, 'listagem deve possuir header Data criação')
assert.match(source, /formatDate\(item\.createdAt\)|new Date\(item\.createdAt\)\.toLocaleDateString\('pt-BR'\)/, 'listagem deve exibir item.createdAt formatado')
assert.match(source, />Prazo</, 'listagem deve manter coluna Prazo')
assert.match(source, /Detalhes/, 'listagem deve manter link Detalhes')

console.log('nonconformity list createdAt column static ok')
