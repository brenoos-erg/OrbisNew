const assert = require('node:assert/strict')
const fs = require('node:fs')

const creationPage = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx', 'utf8')
const createRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const accessPolicy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const constantsSource = fs.readFileSync('src/lib/experienceEvaluation.constants.ts', 'utf8')
const sharedSource = fs.readFileSync('src/lib/experienceEvaluation.shared.ts', 'utf8')

assert.match(constantsSource, /EXPERIENCE_EVALUATION_STATUS[\s\S]*["']AGUARDANDO_AVALIACAO_GESTOR["']/, 'status do gestor deve ser AGUARDANDO_AVALIACAO_GESTOR')
assert.match(constantsSource, /EXPERIENCE_EVALUATION_VISIBLE_STATUSES[\s\S]*EXPERIENCE_EVALUATION_STATUS/, 'status do gestor deve estar entre os status visíveis de RQ_RH_103')

for (const key of [
  'gestorImediatoAvaliadorId',
  'gestorImediatoAvaliador',
  'gestorImediatoAvaliadorLogin',
  'gestorImediatoAvaliadorEmail',
  'avaliadorId',
  'avaliador',
  'avaliadorLogin',
  'avaliadorEmail',
  'gestorId',
  'gestor',
  'gestorLogin',
  'gestorEmail',
]) {
  assert.match(sharedSource, new RegExp(`${key}: normalized|${key}: ''`), `payload deve preencher ${key}`)
}

assert.match(sharedSource, /matchesByAssignedName[\s\S]*normalize\(assigned\.fullName\) === userFullName/, 'fallback por nome normalizado permite o avaliador selecionado quando approverId está vazio')
assert.match(sharedSource, /canonicalApproverId[\s\S]*return Boolean\(userId\) && canonicalApproverId === userId/, 'approverId continua sendo a identidade canônica quando preenchido')

assert.match(creationPage, /campos\.gestorImediatoAvaliadorLogin\s*=\s*selectedCoordinator\?\.login/, 'abertura deve persistir login do avaliador')
assert.match(creationPage, /campos\.gestorImediatoAvaliadorEmail\s*=\s*selectedCoordinator\?\.email/, 'abertura deve persistir e-mail do avaliador')
assert.match(creationPage, /campos\.avaliadorId\s*=\s*campos\.gestorImediatoAvaliadorId/, 'abertura deve duplicar id no alias avaliadorId')
assert.match(creationPage, /campos\.gestorId\s*=\s*campos\.gestorImediatoAvaliadorId/, 'abertura deve duplicar id no alias gestorId')

assert.match(createRoute, /approverId:\s*evaluator\.id/, 'criação deve gravar approverId com o avaliador selecionado')
assert.match(createRoute, /status:\s*EXPERIENCE_EVALUATION_STATUS/, 'criação deve abrir em AGUARDANDO_AVALIACAO_GESTOR')
assert.match(createRoute, /patchExperienceEvaluationEvaluatorPayload\(payload, evaluator\)/, 'criação deve normalizar campos do avaliador no payload')

assert.match(accessPolicy, /addExperienceEvaluationEvaluatorJsonFilters\(receivedFilters, ctx\)/, 'recebidas deve incluir fallback por payload do avaliador')
assert.match(accessPolicy, /tipoId:\s*EXPERIENCE_EVALUATION_TIPO_ID,[\s\S]*status:\s*EXPERIENCE_EVALUATION_STATUS,[\s\S]*OR:\s*identityFilters/, 'fallback de recebidas deve ficar restrito a RQ_RH_103 aguardando avaliação')
assert.match(accessPolicy, /gestorImediatoAvaliadorEmail/, 'fallback deve considerar e-mail do avaliador')
assert.match(accessPolicy, /gestorImediatoAvaliadorLogin/, 'fallback deve considerar login do avaliador')
assert.match(accessPolicy, /gestorImediatoAvaliador'/, 'fallback deve considerar nome do avaliador')
assert.match(accessPolicy, /ctx\.departmentIds/, 'política de recebidas mantém visibilidade por departamento/RH existente')
assert.match(accessPolicy, /ctx\.tipoViewerTipoIds/, 'política de recebidas mantém visualizadores configurados')
assert.match(accessPolicy, /ctx\.tipoFinalizerTipoIds/, 'política de recebidas mantém finalizadores/coordenadores configurados')
