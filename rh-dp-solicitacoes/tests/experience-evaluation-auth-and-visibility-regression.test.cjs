const assert = require('node:assert/strict')
const fs = require('node:fs')

const recebidasApi = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const listApi = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const recebidasPage = fs.readFileSync('src/app/dashboard/solicitacoes/recebidas/page.tsx', 'utf8')
const enviadasPage = fs.readFileSync('src/app/dashboard/solicitacoes/enviadas/page.tsx', 'utf8')

assert.match(
  recebidasApi,
  /err instanceof Error && err\.message === 'Usuário não autenticado'/,
  'A rota de recebidas deve tratar explicitamente sessão ausente com erro 401.',
)
assert.match(
  recebidasApi,
  /NextResponse\.json\(\{ error: err\.message \}, \{ status: 401 \}\)/,
  'A rota de recebidas deve devolver 401 para usuário não autenticado.',
)

assert.match(
  listApi,
  /buildSensitiveHiringVisibilityWhere\(\{\s*userId: me\.id,\s*userLogin: me\.login,\s*userEmail: me\.email,\s*userFullName: me\.fullName,/s,
  'A API de solicitações deve usar os mesmos identificadores da rota de recebidas na visibilidade sensível.',
)

assert.match(
  recebidasPage,
  /const \{ data: sessionData, loading: sessionLoading(?:, refresh: refreshSession)? \} = useSessionMe\(\)/,
  'A tela de recebidas deve respeitar estado de sessão antes de consultar a API.',
)
assert.match(
  recebidasPage,
  /if \(sessionLoading\) return/,
  'A tela de recebidas não deve disparar chamadas antes da sessão carregar.',
)
assert.match(
  recebidasPage,
  /if \(sessionExpired\) return/,
  'A tela de recebidas deve interromper polling após detectar sessão expirada.',
)
assert.match(
  recebidasPage,
  /Sua sessão expirou\. Faça login novamente\./,
  'A tela de recebidas deve informar expiração de sessão quando receber 401.',
)

assert.match(
  enviadasPage,
  /const \{ data: sessionData, loading: sessionLoading, refresh: refreshSession \} = useSessionMe\(\)/,
  'A tela de enviadas também deve considerar sessão para manter coerência com recebidas.',
)
assert.match(
  enviadasPage,
  /if \(sessionLoading\) return/,
  'A tela de enviadas não deve disparar chamadas enquanto a sessão carrega.',
)
assert.match(
  enviadasPage,
  /res\.status === 401/,
  'A tela de enviadas deve tratar 401 como sessão expirada.',
)

console.log('experience-evaluation-auth-and-visibility-regression ok')
