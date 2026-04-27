const fs = require('fs')
const assert = require('assert')

const sidebarSource = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8')
const dashboardLayoutSource = fs.readFileSync('src/app/dashboard/layout.tsx', 'utf8')
const externalAdmissionPageSource = fs.readFileSync(
  'src/app/dashboard/solicitacoes/externas-admissao/page.tsx',
  'utf8',
)
const externalAdmissionRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/externas/admissao/route.ts',
  'utf8',
)
const externalAdmissionByIdRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/externas/admissao/[id]/route.ts',
  'utf8',
)
const externalAdmissionPublicRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/externas/admissao/public/[token]/route.ts',
  'utf8',
)

assert.match(
  dashboardLayoutSource,
  /canAccessExternalAdmissions = await userHasRhAccess\(appUser\)/,
  'Dashboard deve calcular acesso RH para liberar aba de solicitações externas.',
)
assert.match(
  sidebarSource,
  /canAccessExternalAdmissions && \(/,
  'Sidebar deve esconder a aba de solicitações externas para quem não é RH.',
)

assert.match(
  externalAdmissionPageSource,
  /if \(res\.status === 403\) \{\s*\n\s*setAccessDenied\(true\)/,
  'Tela de solicitações externas deve tratar 403 e exibir acesso negado.',
)
assert.match(
  externalAdmissionPageSource,
  /method: 'DELETE'/,
  'Tela de solicitações externas deve chamar endpoint de exclusão.',
)

assert.match(
  externalAdmissionRouteSource,
  /if \(!\(await userHasRhAccess\(me\)\)\)/,
  'GET\/POST internos de admissões externas devem exigir RH.',
)
assert.match(
  externalAdmissionByIdRouteSource,
  /export async function DELETE/,
  'API interna de admissões externas deve expor DELETE por ID.',
)
assert.match(
  externalAdmissionByIdRouteSource,
  /status: 'CANCELADA'/,
  'Exclusão deve ser soft delete via CANCELADA para preservar histórico.',
)
assert.match(
  externalAdmissionByIdRouteSource,
  /status: 'EXCLUIDA'/,
  'Exclusão deve marcar status funcional de admissão como EXCLUIDA.',
)

assert.match(
  externalAdmissionPublicRouteSource,
  /status: \{ not: 'CANCELADA' \}/,
  'Rota pública por token não deve retornar solicitações canceladas.',
)
assert.match(
  externalAdmissionPublicRouteSource,
  /isDeletedAdmission/,
  'Rota pública por token deve bloquear solicitações excluídas.',
)

console.log('✅ external-admission-rh-access-and-delete.test passed')
