const assert = require('node:assert/strict')
const fs = require('node:fs')

const accessPolicy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const permissionGuards = fs.readFileSync('src/lib/solicitationPermissionGuards.ts', 'utf8')
const visibility = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')
const detailRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/route.ts', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')

const guardedActionRoutes = [
  'src/app/api/solicitacoes/[id]/assumir/route.ts',
  'src/app/api/solicitacoes/[id]/atualizar-campos/route.ts',
  'src/app/api/solicitacoes/[id]/comentarios/route.ts',
  'src/app/api/solicitacoes/[id]/anexos/route.ts',
  'src/app/api/solicitacoes/[id]/aprovar/route.ts',
  'src/app/api/solicitacoes/[id]/reprovar/route.ts',
  'src/app/api/solicitacoes/[id]/finalizar/route.ts',
  'src/app/api/solicitacoes/[id]/encerrar/route.ts',
  'src/app/api/solicitacoes/[id]/cancelamento/aprovar/route.ts',
  'src/app/api/solicitacoes/[id]/cancelamento/recusar/route.ts',
  'src/app/api/solicitacoes/[id]/cancelar/route.ts',
  'src/app/api/solicitacoes/[id]/solicitar-cancelamento/route.ts',
  'src/app/api/solicitacoes/[id]/equipamento/route.ts',
]

for (const routePath of guardedActionRoutes) {
  const route = fs.readFileSync(routePath, 'utf8')
  assert.match(route, /isViewerOnlyForSolicitation/, `${routePath} deve usar o guard efetivo de VIEWER no backend.`)
}

assert.match(accessPolicy, /export function canUserActOnCurrentStage/, 'A regra de etapa atual deve ser centralizada e reutilizável.')
assert.match(accessPolicy, /solicitation\.departmentId && contextDepartmentIds\(ctx\)\.includes\(solicitation\.departmentId\)/, 'Etapa atual deve reconhecer departamento principal/secundário do usuário.')
assert.match(accessPolicy, /solicitation\.costCenterId && contextCostCenterIds\(ctx\)\.includes\(solicitation\.costCenterId\)/, 'Etapa atual deve reconhecer centro de custo do usuário.')
assert.match(accessPolicy, /contextSetorKeys\(ctx\)\.some\(\(setor\) => setores\.has\(normalizeSolicitationSectorKey\(setor\)\)\)/, 'Etapa atual deve reconhecer setores operacionais do usuário.')
assert.match(accessPolicy, /solicitation\.assumidaPorId === ctx\.userId/, 'Usuário que assumiu deve poder atuar na etapa atual.')
const canUserActOnCurrentStageBody = accessPolicy.slice(accessPolicy.indexOf('export function canUserActOnCurrentStage'), accessPolicy.indexOf('function canUserActAsFinalizerForCurrentStage'))
assert.doesNotMatch(canUserActOnCurrentStageBody, /solicitation\.approverId === ctx\.userId/, 'Aprovador atual não pode virar ator operacional amplo da etapa.')
assert.match(accessPolicy, /export function normalizeSolicitationSectorKey/, 'Setores devem usar normalização central de chave.')
assert.match(accessPolicy, /export function isSolicitationSectorActive/, 'Status ativo do setor deve ser validado por helper central.')
assert.match(accessPolicy, /getActiveSolicitationSectorKeys/, 'Política deve usar apenas setores operacionais ativos.')
assert.match(accessPolicy, /export function canUserOverrideViewerOnlyForCurrentStage/, 'viewerOnly efetivo deve ter override específico sem ampliar todas as ações.')
assert.match(accessPolicy, /isViewerOnlyByPolicy[\s\S]*!canUserOverrideViewerOnlyForCurrentStage\(ctx, solicitation\)/, 'viewerOnly efetivo deve depender do override específico da etapa atual.')

assert.match(permissionGuards, /resolveUserAccessContext/, 'Bloqueio backend por VIEWER deve usar o contexto completo de acesso.')
assert.match(permissionGuards, /isViewerOnlyByPolicy\(userAccess, solicitation\)/, 'Rotas de ação devem compartilhar a mesma decisão efetiva da política.')
assert.match(permissionGuards, /finalizadoEm: true/, 'Guarda backend deve carregar finalização do setor para ignorar setor histórico concluído.')
assert.doesNotMatch(permissionGuards, /normalizedRoles\.has\('VIEWER'\)[\s\S]*!normalizedRoles\.has\('APPROVER'\)/, 'Guarda antiga baseada apenas em papéis do tipo não deve voltar.')

assert.match(visibility, /tipoViewerTipoIds/, 'Visibilidade deve manter VIEWER separado da atuação.')
assert.match(detailRoute, /viewerOnly: isViewerOnlyByPolicy\(userAccess, accessSolicitation\)/, 'API de detalhe deve retornar viewerOnly pela política efetiva.')
assert.match(detailRoute, /canAssume: canAssumeSolicitation\(userAccess, accessSolicitation\)/, 'API de detalhe deve retornar canAssume pela mesma política.')
assert.match(detailRoute, /canEdit: canEditSolicitation\(userAccess, accessSolicitation\)/, 'API de detalhe deve retornar canEdit pela mesma política.')
assert.match(detailRoute, /canComment: canCommentSolicitation\(userAccess, accessSolicitation\)/, 'API de detalhe deve retornar canComment pela mesma política.')

assert.match(detailModal, /const isViewerOnly = detail\?\.viewerOnly === true/, 'Modal deve depender exclusivamente do viewerOnly vindo da API.')
assert.match(detailModal, /Visualizador \(somente leitura\)/, 'UI de detalhe deve sinalizar modo somente leitura.')
assert.match(detailModal, /const apiCanAssume = detail\?\.canAssume === true/, 'Frontend deve usar flag canAssume explícita.')
assert.match(detailModal, /const apiCanComment = detail\?\.canComment === true/, 'Frontend deve usar flag canComment explícita.')
assert.match(detailModal, /apiCanApprove/, 'Frontend deve usar flag canApprove individual.')
assert.match(detailModal, /const apiCanFinalize = detail\?\.canFinalize === true/, 'Frontend deve usar flag canFinalize explícita.')
assert.match(detailModal, /const apiCanCancel = detail\?\.canCancel === true/, 'Frontend deve usar flag canCancel explícita.')

console.log('✅ viewer-visibility-readonly-regression.test passed')
