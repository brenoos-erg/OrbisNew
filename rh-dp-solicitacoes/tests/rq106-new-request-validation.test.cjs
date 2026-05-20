const assert = require('node:assert/strict')
const fs = require('node:fs')

const page = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')
const detail = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')

assert.match(page, /!isRQ106Dependentes/, 'fallback deve ser evitado para RQ.106')
assert.match(page, /Anexo\(s\) Da Solicitação/, 'deve renderizar Anexo(s) Da Solicitação')
assert.match(page, /Anexo\(s\) Do Solicitante/, 'deve renderizar Anexo(s) Do Solicitante')
assert.match(page, /Nome do Solicitante/, 'deve renderizar Nome do Solicitante')
assert.match(page, /CPF/, 'deve renderizar CPF')
assert.match(page, /Observações/, 'deve renderizar Observações')
assert.match(page, /Adicionar Arquivo/, 'deve renderizar Adicionar Arquivo')
assert.match(page, /Nenhum arquivo postado\./, 'deve exibir nenhum arquivo postado')
assert.match(page, /Preencha Nome do Solicitante, CPF e anexe o formulário RQ\.106 preenchido antes de enviar\./, 'deve validar sem nome/cpf/anexo')
assert.match(detail, /nomeSolicitante|cpf|observacoes/, 'detalhe deve suportar campos do RQ.106')

console.info('rq106-new-request-validation.test.cjs: ok')
