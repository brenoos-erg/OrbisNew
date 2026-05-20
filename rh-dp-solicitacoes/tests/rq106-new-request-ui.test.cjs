const assert = require('node:assert/strict')
const fs = require('node:fs')

const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')
const seed = fs.readFileSync('prisma/seed.ts', 'utf8')

assert.match(page, /isRQ106Dependentes/, 'deve identificar tipo RQ.106')
assert.match(page, /Anexe o formulário RQ\.106 na solicitação\./, 'deve mostrar instrução do RQ.106')
assert.match(seed, /label:\s*'Nome do Solicitante'/, 'deve configurar campo Nome do Solicitante')
assert.match(seed, /label:\s*'CPF'/, 'deve configurar campo CPF')
assert.match(seed, /label:\s*'Observações'/, 'deve configurar campo Observações')
assert.match(page, /Adicionar Arquivo/, 'deve renderizar botão Adicionar Arquivo')
assert.match(page, /Anexe o formulário RQ\.106 preenchido antes de enviar a solicitação\./, 'deve bloquear envio sem anexo')

console.info('rq106-new-request-ui.test.cjs: ok')
