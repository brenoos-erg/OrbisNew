const fs = require('fs')
const assert = require('assert')

const fluxoClientSource = fs.readFileSync(
  'src/app/dashboard/configuracoes/fluxo-solicitacao/FluxoSolicitacaoClient.tsx',
  'utf8',
)
const fluxoRouteSource = fs.readFileSync('src/app/api/solicitacoes/fluxo/[id]/route.ts', 'utf8')

assert.match(
  fluxoClientSource,
  /const hasExplicitEvaluatorKeys = \[/,
  'Fluxo no frontend deve detectar edição explícita dos campos canônicos/legados do avaliador.',
)
assert.match(
  fluxoClientSource,
  /if \(!evaluatorId\) \{\s*\n\s*if \(!hasExplicitEvaluatorKeys\) return fields\s*\n\s*return buildEvaluatorFieldPatch\(fields, '', ''\)/,
  'Ao limpar avaliador explicitamente, o payload deve limpar os aliases canônicos e não preservar resíduo.',
)

assert.match(
  fluxoRouteSource,
  /function normalizeIncomingExperienceEvaluatorAliases\(campos: Record<string, unknown>\)/,
  'Backend deve normalizar aliases legados de avaliador antes de processar o patch.',
)
assert.match(
  fluxoRouteSource,
  /const incomingCampos = normalizeIncomingExperienceEvaluatorAliases\(body\.campos \?\? \{\}\)/,
  'PATCH do fluxo deve usar normalização de aliases para detectar troca explícita de avaliador.',
)
assert.match(
  fluxoRouteSource,
  /'gestorimediatoavaliadorid'/,
  'Campos legados de avaliador devem entrar na malha de detecção de alteração explícita.',
)

console.log('✅ experience-evaluation-flow-canonical-regression.test passed')
