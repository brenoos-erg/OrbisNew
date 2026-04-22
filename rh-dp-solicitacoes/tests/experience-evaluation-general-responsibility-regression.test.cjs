const assert = require('node:assert/strict')
const fs = require('node:fs')

const responsibilitySource = fs.readFileSync('src/lib/solicitationResponsibility.ts', 'utf8')
const listRoute = fs.readFileSync('src/app/api/solicitacoes/route.ts', 'utf8')
const receivedRoute = fs.readFileSync('src/app/api/solicitacoes/recebidas/route.ts', 'utf8')
const flowRoute = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')
const receivedQuerySource = fs.readFileSync('src/lib/receivedSolicitationsQuery.ts', 'utf8')

assert.match(
  responsibilitySource,
  /export function shouldUseApproverAsPrimaryResponsible\(tipo\?: SolicitationTypeRef \| null\)/,
  'A resolução estrutural de responsável precisa ter uma regra compartilhada por tipo.',
)

assert.match(
  responsibilitySource,
  /if \(preferApprover\)\s*\{\s*return \{\s*responsavelId: input\.approver\?\.id \?\? input\.approverId \?\? null,/s,
  'A avaliação de experiência deve priorizar approverId/approver como referência principal.',
)

assert.match(
  listRoute,
  /const responsible = resolvePrimaryResponsibleForList\(/,
  'A listagem geral deve usar a regra compartilhada de responsável principal.',
)

assert.match(
  receivedRoute,
  /const responsible = resolvePrimaryResponsibleForList\(/,
  'A listagem de recebidas deve usar a regra compartilhada de responsável principal.',
)

assert.match(
  flowRoute,
  /if \(isExperienceEvaluation && resolvedApproverId !== undefined\) \{\s*resolvedResponsibleId = null\s*\}/s,
  'Editar avaliador no fluxo deve limpar assumidaPor para não manter responsável legado.',
)

assert.match(
  flowRoute,
  /const primaryResponsible = resolvePrimaryResponsibleForList\(/,
  'O retorno do fluxo deve expor responsável atual já canônico para a UI.',
)

assert.match(
  receivedQuerySource,
  /OR:\s*\[\s*\{ assumidaPor: \{ fullName: \{ contains: responsavel \} \} \},\s*\{ approver: \{ fullName: \{ contains: responsavel \} \} \},\s*\]/s,
  'Filtro por responsável deve localizar tanto atendente quanto avaliador responsável.',
)

console.log('✅ experience-evaluation-general-responsibility-regression.test passed')
