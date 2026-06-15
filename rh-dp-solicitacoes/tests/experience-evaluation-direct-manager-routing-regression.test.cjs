const fs = require('fs')
const assert = require('assert')

const route = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const receivedPolicy = fs.readFileSync('src/lib/receivedSolicitationsQuery.ts', 'utf8')
const accessPolicy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const helper = fs.readFileSync('src/lib/experienceEvaluation.shared.ts', 'utf8')

assert.match(route, /tipoId === EXPERIENCE_EVALUATION_TIPO_ID/, 'RQ_RH_103 deve ser detectado na criação')
assert.match(route, /patchExperienceEvaluationEvaluatorPayload\(payload, gestorSelecionado\)/, 'payload deve ser normalizado com helper existente')
assert.match(route, /approverId:\s*isAvaliacaoExperiencia \? String\(payload\?\.campos\?\.gestorImediatoAvaliadorId/, 'criação deve gravar approverId do gestor')
assert.match(route, /if \(isAvaliacaoExperiencia\) return false[\s\S]*requiresApproval/, 'avaliação de experiência não deve entrar em aprovação genérica')
assert.match(route, /if \(isAvaliacaoExperiencia\) return 'NAO_PRECISA'[\s\S]*approvalStatus/, 'avaliação de experiência não deve ficar pendente de aprovadores')
assert.match(route, /if \(isAvaliacaoExperiencia\) return EXPERIENCE_EVALUATION_STATUS as any[\s\S]*status/, 'status inicial deve ser AGUARDANDO_AVALIACAO_GESTOR')
assert.match(receivedPolicy, /AGUARDANDO_AVALIACAO_GESTOR/, 'recebidas deve tratar etapa do gestor avaliador')
assert.match(accessPolicy, /isExperienceEvaluationEvaluator/, 'política de acesso deve permitir o gestor avaliador')
assert.match(helper, /resolveExperienceEvaluationAssignedEvaluator/, 'helper deve resolver avaliador pelo payload/approverId')

console.info('experience-evaluation-direct-manager-routing-regression.test.cjs: ok')
