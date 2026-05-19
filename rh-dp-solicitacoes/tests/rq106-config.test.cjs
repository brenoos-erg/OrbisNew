const assert = require('node:assert/strict')
const fs = require('node:fs')

const seed = fs.readFileSync('prisma/seed.ts', 'utf8')
assert.match(seed, /id:\s*'RQ_106'/, 'RQ_106 deve existir no seed')
assert.match(seed, /requiresAttachment:\s*true/, 'RQ_106 deve exigir anexo')
assert.match(seed, /templateDownload:\s*'\/templates\/solicitacoes\/RQ\.106 - Pedido de Exclusao de Dependentes no Plano Medico e Odontologico\.docx'/, 'RQ_106 deve ter templateDownload configurado')
assert.match(seed, /name:\s*'nomeSolicitante'/, 'RQ_106 deve conter campo Nome do Solicitante')
assert.match(seed, /name:\s*'cpf'/, 'RQ_106 deve conter campo CPF')
assert.match(seed, /name:\s*'observacoes'/, 'RQ_106 deve conter campo Observações')
assert.match(seed, /name:\s*'anexosSolicitante'.*required:\s*true/s, 'RQ_106 deve conter anexo obrigatório do solicitante')

console.info('rq106-config.test.cjs: ok')
