const assert = require('node:assert/strict')
const fs = require('node:fs')

const accessSource = fs.readFileSync('src/lib/access.ts', 'utf8')
const countsRouteSource = fs.readFileSync('src/app/api/solicitacoes/counts/route.ts', 'utf8')

assert.match(
  accessSource,
  /err instanceof Error && err\.message === 'Usuário não autenticado'[\s\S]*status:\s*401/s,
  'withModuleLevel deve retornar 401 para usuário não autenticado.',
)

assert.match(
  accessSource,
  /err instanceof Error && err\.message === 'Usuário inativo'[\s\S]*status:\s*403/s,
  'withModuleLevel deve retornar 403 para usuário inativo.',
)

assert.match(
  accessSource,
  /Serviço indisponível\. Não foi possível conectar ao banco de dados\.[\s\S]*status:\s*503/s,
  'withModuleLevel deve retornar 503 para indisponibilidade de banco.',
)

assert.match(
  countsRouteSource,
  /resolveUserAccessContext\(\{[\s\S]*userLogin:\s*me\.login,[\s\S]*userEmail:\s*me\.email,[\s\S]*userFullName:\s*me\.fullName,/s,
  'A rota de contagens deve usar login/email/nome ao montar contexto de visibilidade.',
)

assert.match(
  countsRouteSource,
  /status:\s*'AGUARDANDO_AVALIACAO_GESTOR'[\s\S]*AND:\s*\[receivedVisibilityWhere\]/s,
  'A contagem de recebidas deve seguir a mesma política de visibilidade da listagem para avaliação do gestor.',
)

console.log('solicitacoes-auth-and-counts-regression ok')
