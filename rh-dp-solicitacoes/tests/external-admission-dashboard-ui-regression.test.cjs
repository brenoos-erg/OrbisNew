const fs = require('fs')
const assert = require('assert')

const pageSource = fs.readFileSync(
  'src/app/dashboard/solicitacoes/externas-admissao/page.tsx',
  'utf8',
)

assert.match(
  pageSource,
  /Solicitações Externas — Admissão/,
  'Tela deve renderizar o título principal da página.',
)
assert.match(
  pageSource,
  /Novo processo externo/,
  'Tela deve renderizar bloco do formulário de criação de processo.',
)

assert.match(
  pageSource,
  /label: 'Total de processos'/,
  'Tela deve apresentar card de resumo com total de processos.',
)
assert.match(
  pageSource,
  /label: 'Aguardando envio'/,
  'Tela deve apresentar card de resumo de aguardando envio.',
)
assert.match(
  pageSource,
  /label: 'Falhas de e-mail'/,
  'Tela deve apresentar card de resumo de falhas de e-mail.',
)

assert.match(
  pageSource,
  /rows\.filter\(\(row\) => \{[\s\S]*candidateName\.toLowerCase\(\)\.includes\(normalizedSearch\)[\s\S]*row\.status === statusFilter[\s\S]*row\.emailDeliveryStatus === emailStatusFilter/,
  'Tela deve aplicar filtros client-side por busca, status e status de e-mail.',
)

assert.match(
  pageSource,
  /navigator\.clipboard\.writeText\(url\)/,
  'Botão de copiar link deve utilizar clipboard.',
)
assert.match(
  pageSource,
  /fetch\(`\/api\/solicitacoes\/externas\/admissao\/\$\{id\}`, \{ method: 'POST' \}\)/,
  'Botão de reenviar e-mail deve chamar o endpoint correto por ID.',
)
assert.match(
  pageSource,
  /window\.confirm\('Confirma a exclusão desta solicitação externa\? Essa ação irá cancelar o processo\.'/,
  'Exclusão deve pedir confirmação explícita.',
)
assert.match(
  pageSource,
  /method: 'DELETE'/,
  'Exclusão deve chamar endpoint DELETE por ID.',
)

assert.match(
  pageSource,
  /AGUARDANDO_ENVIO:[\s\S]*label: 'Aguardando envio'/,
  'Status AGUARDANDO_ENVIO deve exibir label amigável.',
)
assert.match(
  pageSource,
  /ENVIADO_PELO_CANDIDATO:[\s\S]*label: 'Enviado pelo candidato'/,
  'Status ENVIADO_PELO_CANDIDATO deve exibir label amigável.',
)
assert.match(
  pageSource,
  /EM_CONFERENCIA:[\s\S]*label: 'Em conferência'/,
  'Status EM_CONFERENCIA deve exibir label amigável.',
)
assert.match(
  pageSource,
  /PENDENTE:[\s\S]*label: 'Pendente'/,
  'Status PENDENTE deve exibir label amigável.',
)
assert.match(
  pageSource,
  /CONCLUIDO:[\s\S]*label: 'Concluído'/,
  'Status CONCLUIDO deve exibir label amigável.',
)

assert.match(
  pageSource,
  /Nenhum processo encontrado para os filtros aplicados\./,
  'Tela deve exibir estado vazio quando não houver processos após filtros.',
)

console.log('✅ external-admission-dashboard-ui-regression.test passed')
