const assert = require('node:assert/strict')
const fs = require('node:fs')

const accessPolicy = fs.readFileSync('src/lib/solicitationAccessPolicy.ts', 'utf8')
const visibility = fs.readFileSync('src/lib/solicitationVisibility.ts', 'utf8')
const detailRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/route.ts', 'utf8')
const detailModal = fs.readFileSync('src/components/solicitacoes/SolicitationDetailModal.tsx', 'utf8')

const assumeRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/assumir/route.ts', 'utf8')
const updateFieldsRoute = fs.readFileSync('src/app/api/solicitacoes/[id]/atualizar-campos/route.ts', 'utf8')

assert.match(
  accessPolicy,
  /actionableTipoIds:\s*Array\.from\(new Set\(approverTipoRows\.map\(\(row\) => row\.tipoId\)\)\)/,
  'Contexto de ação deve considerar apenas tipos com papel de APPROVER para evitar ações indevidas de VIEWER.',
)

assert.match(
  accessPolicy,
  /if \(solicitation\.tipoId && ctx\.actionableTipoIds\.includes\(solicitation\.tipoId\)\) \{/,
  'Ações operacionais por tipo não devem ser liberadas para VIEWER.',
)

assert.match(
  assumeRoute,
  /const isViewerOnly = await isViewerOnlyForSolicitation\(\{ solicitationId, userId: me\.id \}\)/,
  'API de assumir deve bloquear usuário VIEWER.',
)

assert.match(
  updateFieldsRoute,
  /const isViewerOnly = await isViewerOnlyForSolicitation\(\{ solicitationId: id, userId: me\.id \}\)/,
  'API de atualização de campos deve bloquear usuário VIEWER.',
)

assert.match(
  accessPolicy,
  /allowedTipoIds:\s*Array\.from\(new Set\(allowedTipoRows\.map\(\(row\) => row\.tipoId\)\)\)/,
  'Contexto de acesso deve incluir todos os tipos vinculados ao usuário (incluindo VIEWER).',
)

assert.match(
  visibility,
  /if \(input\.allowedTipoIds\.length > 0\) \{\s*regularSolicitationOrFilters\.push\(\{\s*tipoId:\s*\{\s*in:\s*input\.allowedTipoIds/s,
  'Visibilidade de recebidas deve permitir listagem por tipo permitido (incluindo VIEWER).',
)

assert.match(
  detailRoute,
  /const viewerOnly = await isViewerOnlyForSolicitation\(\{\s*solicitationId: item\.id,\s*userId: me\.id,\s*\}\)/s,
  'Detalhe da solicitação deve resolver perfil VIEWER por tipo para o usuário atual.',
)

assert.match(
  detailRoute,
  /viewerOnly,/,
  'API de detalhe deve retornar indicador viewerOnly para a UI.',
)

assert.match(
  detailModal,
  /const isViewerOnly = detail\?\.viewerOnly === true/,
  'Modal deve detectar quando o usuário está em modo VIEWER (somente leitura).',
)

assert.match(
  detailModal,
  /const showManagementActions = !isApprovalMode && canManage && !isViewerOnly/,
  'Ações de gestão devem ficar ocultas para VIEWER.',
)

assert.match(
  detailModal,
  /approvalStatus === 'PENDENTE' &&\s*!isViewerOnly &&/s,
  'Ações de aprovação/reprovação devem ficar indisponíveis para VIEWER.',
)

assert.match(
  detailModal,
  /Visualizador \(somente leitura\)/,
  'UI de detalhe deve sinalizar claramente quando o usuário está como visualizador.',
)

console.log('✅ viewer-visibility-readonly-regression.test passed')
