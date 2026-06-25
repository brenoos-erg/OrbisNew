const assert = require('node:assert/strict')
const fs = require('node:fs')

const accessPolicy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const visibility = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')
const responsibility = fs.readFileSync('src/lib/solicitationResponsibility.ts', 'utf8')
const solicitacoesRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const recebidasRoute = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const dynamicRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/route.ts', 'utf8')

for (const name of [
  'resolveUserAccessContext',
  'canAssumeSolicitation',
  'canFinalizeSolicitation',
  'canFinalizeNadaConstaGlobal',
  'canViewSolicitation',
  'canCancelSolicitation',
  'canManageCancellationRequest',
  'canRequesterEditRq092AfterSubmit',
  'canPrintExperienceEvaluationPdf',
]) {
  assert.match(accessPolicy, new RegExp(`export (async )?function ${name}\\b`), `solicitationAccessPolicy exporta ${name}`)
}
assert.match(visibility, /export function buildRhSharedHiringFlowVisibilityWhere\b/, 'visibility exporta RH/DP compartilhado')

assert.match(responsibility, /gestorImediatoAvaliadorId/, 'responsabilidade usa fallback de id do gestor avaliador')
assert.match(responsibility, /gestorImediatoAvaliador/, 'responsabilidade usa fallback de nome do gestor avaliador')
assert.match(responsibility, /RH \/ Coordenadores de Avaliação/, 'finalização da avaliação mostra grupo RH/coordenadores')
assert.match(solicitacoesRoute, /resolvePrimaryResponsibleForList/, 'listagem geral resolve responsável por regra central')
assert.match(recebidasRoute, /resolvePrimaryResponsibleForList/, 'recebidas resolve responsável por regra central')
assert.match(solicitacoesRoute, /payload: s\.payload/, 'listagem geral envia payload para fallback de avaliação')
assert.match(recebidasRoute, /payload: s\.payload/, 'recebidas envia payload para fallback de avaliação')

assert.match(dynamicRoute, /params: Promise<\{ id: string \}>/, 'rota [id] usa params Promise no Next 16')
assert.doesNotMatch(dynamicRoute, /params\.id/, 'rota [id] não acessa params.id síncrono')

console.log('experience-evaluation-responsibility-regression.test.cjs ok')
