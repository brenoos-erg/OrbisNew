const assert = require('node:assert/strict')
const fs = require('node:fs')

const accessSource = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const visibilitySource = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')
const sensitiveSource = fs.readFileSync('src/lib/sensitiveHiringRequests.ts', 'utf8')
const responsibilitySource = fs.readFileSync('src/lib/solicitationResponsibility.ts', 'utf8')
const receivedRouteSource = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const finalizeRouteSource = fs.readFileSync('src/app/api/solicitacoes/[id]/finalizar/route.ts', 'utf8')
const countsRouteSource = fs.readFileSync('src/app/api/solicitacoes/counts/route.ts', 'utf8')


assert.match(
  accessSource,
  /isRhAuthorizedForExperienceEvaluation[\s\S]*hasSolicitationsModuleAccess[\s\S]*input\.role === 'RH'[\s\S]*isRhDepartment/s,
  'O contexto deve identificar RH autorizado por módulo Solicitações e vínculo RH.',
)

assert.match(
  visibilitySource,
  /input\.finalizerTipoIds\.includes\(EXPERIENCE_EVALUATION_TIPO_ID\) \|\|[\s\S]*input\.isExperienceEvaluationCoordinator \|\|[\s\S]*input\.isRhAuthorizedForExperienceEvaluation[\s\S]*status:\s*EXPERIENCE_EVALUATION_FINALIZATION_STATUS/s,
  'AGUARDANDO_FINALIZACAO_AVALIACAO deve aparecer também para RH autorizado.',
)

assert.match(
  sensitiveSource,
  /finalizerTipoIds\?: string\[\][\s\S]*isRhAuthorizedForExperienceEvaluation\?: boolean[\s\S]*finalizerTipoIds\.includes\('RQ_RH_103'\) \|\|[\s\S]*input\.isRhAuthorizedForExperienceEvaluation[\s\S]*status:\s*'AGUARDANDO_FINALIZACAO_AVALIACAO'/s,
  'A trava sensível deve liberar a etapa final para finalizadores RQ_RH_103 e RH autorizado.',
)

assert.match(
  accessSource,
  /ctx\.finalizerTipoIds\.includes\(solicitation\.tipoId\) \|\|[\s\S]*ctx\.isExperienceEvaluationCoordinator \|\|[\s\S]*ctx\.isRhAuthorizedForExperienceEvaluation/s,
  'Finalização deve aceitar finalizador configurado, coordenador de avaliação ou RH autorizado.',
)

assert.match(
  accessSource,
  /EXPERIENCE_EVALUATOR_GROUP_NAME[\s\S]*prisma\.approverGroupMember\.findFirst\([\s\S]*group:\s*\{ name: EXPERIENCE_EVALUATOR_GROUP_NAME \}/s,
  'O contexto de acesso deve identificar membros do grupo COORDENADORES_AVALIACAO_EXPERIENCIA.',
)

assert.match(
  visibilitySource,
  /status:\s*EXPERIENCE_EVALUATION_STATUS[\s\S]*input\.isExperienceEvaluationCoordinator[\s\S]*\{ id:\s*\{ not:\s*'' \} \}/s,
  'AGUARDANDO_AVALIACAO_GESTOR deve aparecer para coordenadores de avaliação sem abrir para todos.',
)

assert.match(
  visibilitySource,
  /input\.finalizerTipoIds\.includes\(EXPERIENCE_EVALUATION_TIPO_ID\) \|\|\s*input\.isExperienceEvaluationCoordinator[\s\S]*status:\s*EXPERIENCE_EVALUATION_FINALIZATION_STATUS/s,
  'AGUARDANDO_FINALIZACAO_AVALIACAO deve aparecer para finalizadores do tipo ou coordenadores de avaliação.',
)

assert.match(
  sensitiveSource,
  /isExperienceEvaluationCoordinator\?: boolean[\s\S]*if \(input\.isExperienceEvaluationCoordinator\) \{[\s\S]*tipoId: 'RQ_RH_103'[\s\S]*status:\s*\{[\s\S]*in:\s*\['AGUARDANDO_AVALIACAO_GESTOR', 'AGUARDANDO_FINALIZACAO_AVALIACAO'\]/s,
  'A trava de solicitações sensíveis deve preservar visibilidade de RQ.RH.103 para coordenadores apenas nos status pendentes da avaliação.',
)

assert.match(
  accessSource,
  /function canUserActAsFinalizerForCurrentStage[\s\S]*ctx\.finalizerTipoIds\.includes\(solicitation\.tipoId\) \|\|\s*ctx\.isExperienceEvaluationCoordinator/s,
  'Finalização deve aceitar finalizador configurado ou coordenador de avaliação.',
)

assert.match(
  accessSource,
  /isExperienceFinalizationStage[\s\S]*canUserActAsFinalizerForCurrentStage\(ctx, solicitation\)[\s\S]*solicitation\.approverId !== ctx\.userId/s,
  'canFinalizeSolicitation não deve depender de canUserActOnCurrentStage, que exclui avaliação de experiência.',
)

assert.match(
  responsibilitySource,
  /EXPERIENCE_EVALUATION_FINALIZATION_STATUS[\s\S]*RH \/ Coordenadores de Avaliação/s,
  'resolvePrimaryResponsibleForList deve retornar responsável legível na finalização, não null/—.',
)

assert.match(
  receivedRouteSource,
  /DEBUG_SOLICITACOES_RECEBIDAS[\s\S]*policy-context[\s\S]*query-result/s,
  'Recebidas deve ter logs de debug com contexto de política e resultado da consulta.',
)

assert.match(
  receivedRouteSource,
  /isExperienceEvaluationCoordinator:\s*userAccess\.isExperienceEvaluationCoordinator[\s\S]*isRhAuthorizedForExperienceEvaluation:[\s\S]*userAccess\.isRhAuthorizedForExperienceEvaluation/,
  'Recebidas deve passar a permissão de coordenador para a trava sensível.',
)

assert.match(
  countsRouteSource,
  /isExperienceEvaluationCoordinator:\s*userAccess\.isExperienceEvaluationCoordinator[\s\S]*isRhAuthorizedForExperienceEvaluation:[\s\S]*userAccess\.isRhAuthorizedForExperienceEvaluation/,
  'Contagens devem usar a mesma visibilidade de coordenador que a listagem.',
)

assert.match(
  finalizeRouteSource,
  /canFinalizeSolicitation\(userAccess,[\s\S]*status: solicitation\.status/s,
  'A rota de finalizar deve validar a etapa atual ao aplicar a política.',
)


assert.match(
  receivedRouteSource,
  /resolvePrimaryResponsibleForList\(\{[\s\S]*approverId: s\.approverId,[\s\S]*status: s\.status/s,
  'Recebidas deve passar status para resolver responsável legível na finalização da avaliação.',
)

console.log('experience-evaluation-received-finalization-regression ok')
