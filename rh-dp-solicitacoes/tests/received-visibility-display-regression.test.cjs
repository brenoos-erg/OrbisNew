const assert = require('node:assert/strict')
const fs = require('node:fs')

const recebidasRoute = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const solicitacoesRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const page = fs.readFileSync('src/app/dashboard/solicitacoes/recebidas/page.tsx', 'utf8')
const policy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const debug = fs.readFileSync('scripts/debug-received-visibility.ts', 'utf8')
const types = fs.readFileSync('src/lib/solicitationTypes.ts', 'utf8')

for (const [name, source] of [['recebidas', recebidasRoute], ['solicitacoes', solicitacoesRoute]]) {
  assert.match(
    source,
    /tipo:\s*s\.tipo \? \{ id: s\.tipo\.id, codigo: s\.tipo\.codigo, nome: s\.tipo\.nome \} : null/,
    `${name} deve retornar tipo completo id/codigo/nome`,
  )
}

assert.match(page, /function formatSolicitationType\(row:/, 'frontend deve ter helper seguro para tipo')
assert.match(page, /return 'Tipo não identificado'/, 'helper deve ter fallback legível')
assert.doesNotMatch(page, /`\$\{row\.tipo\.codigo\} - \$\{row\.tipo\.nome\}`/, 'tabela não deve renderizar undefined - nome')
assert.match(page, /formatSolicitationType\(row\),/, 'export CSV deve usar helper seguro')
assert.match(page, /function formatAssignee\(row: Row\)/, 'frontend deve explicar atendente em ABERTA')
assert.match(page, /Aguardando setor assumir/, 'ABERTA com destino deve orientar que o setor ainda precisa assumir')
assert.match(page, /Aguardando responsável/, 'ABERTA sem destino deve ter fallback')

assert.match(policy, /departmentId:\s*\{ in: ctx\.departmentIds as string\[\] \}/, 'política deve incluir departamento atual')
assert.match(policy, /costCenterId:\s*\{ in: ctx\.costCenterIds as string\[\] \}/, 'política deve incluir centro de custo atual')
assert.match(policy, /tipoApproverTipoIds/, 'política deve incluir APPROVER do tipo')
assert.match(policy, /tipoViewerTipoIds/, 'política deve incluir VIEWER do tipo')
assert.match(policy, /tipoFinalizerTipoIds/, 'política deve incluir FINALIZER do tipo')
assert.match(policy, /solicitacaoSetores:\s*\{[\s\S]*some:\s*\{ setor:\s*\{ in: ctx\.nadaConstaSetores as string\[\] \}/, 'Nada Consta deve filtrar setores do usuário')
assert.match(policy, /isExperienceEvaluationTipo/, 'Avaliação de Experiência deve ser identificada por helper id/código/nome')
assert.match(policy, /EXPERIENCE_EVALUATION_VISIBLE_STATUSES/, 'Avaliação de Experiência deve usar lista canônica de status visíveis')
assert.match(debug, /Esta Solicitação de Pessoal ainda está aguardando aprovação/, 'diagnóstico RQ_063 deve explicar pendência de aprovação')

assert.match(debug, /--user <login\|email>/, 'script de diagnóstico deve aceitar usuário')
assert.match(debug, /requiresApproval/, 'diagnóstico deve expor requiresApproval')
assert.match(debug, /approvalStatus/, 'diagnóstico deve expor approvalStatus')
assert.match(debug, /solicitacaoSetores/, 'diagnóstico deve expor setores do Nada Consta')
assert.match(debug, /policyResult/, 'diagnóstico deve expor resultado objetivo da política')
assert.match(debug, /objectiveReason/, 'diagnóstico deve expor motivo objetivo')

for (const setor of ['DP', 'TI', 'ALMOX', 'LOGISTICA', 'SST', 'SAUDE', 'FINANCEIRO', 'FISCAL']) {
  assert.match(types, new RegExp(`'${setor}'`), `resolveNadaConstaSetoresByDepartment deve conhecer ${setor}`)
}

console.log('received visibility/display regressions ok')
