const fs = require('fs')
const assert = require('assert')

const admissionRouteSource = fs.readFileSync('src/app/api/solicitacoes/externas/admissao/route.ts', 'utf8')
const admissionByIdRouteSource = fs.readFileSync('src/app/api/solicitacoes/externas/admissao/[id]/route.ts', 'utf8')
const publicRouteSource = fs.readFileSync('src/app/api/solicitacoes/externas/admissao/public/[token]/route.ts', 'utf8')
const publicAttachmentRouteSource = fs.readFileSync(
  'src/app/api/solicitacoes/externas/admissao/public/[token]/attachments/[attachmentId]/route.ts',
  'utf8',
)
const publicPageSource = fs.readFileSync('src/app/solicitacoes/externo/admissao/[token]/page.tsx', 'utf8')

assert.match(
  admissionRouteSource,
  /resolveAppBaseUrl\(\{ context: 'external-admission-link' \}\)/,
  'Criação do processo externo deve gerar link com URL pública configurada.',
)
assert.match(
  admissionRouteSource,
  /sendExternalAdmissionEmail\(/,
  'Criação do processo externo deve disparar envio automático de e-mail.',
)
assert.match(
  admissionRouteSource,
  /emailSent:\s*true|emailSent\s*=\s*true/,
  'Payload de criação deve sinalizar sucesso de e-mail quando aplicável.',
)
assert.match(
  admissionRouteSource,
  /emailDeliveryStatus/,
  'Payload de admissão externa deve persistir status de entrega de e-mail.',
)
assert.match(
  admissionRouteSource,
  /emailError/,
  'Payload de admissão externa deve persistir erro de e-mail em caso de falha.',
)

assert.match(
  admissionByIdRouteSource,
  /export async function POST\(/,
  'Endpoint interno deve permitir reenvio de e-mail do link externo.',
)
assert.match(
  admissionByIdRouteSource,
  /emailResentAt/,
  'Reenvio de e-mail deve persistir carimbo de data/hora no payload.',
)

assert.match(
  publicRouteSource,
  /allowedTypes:\s*\['PDF', 'JPG', 'PNG', 'DOC', 'DOCX'\]/,
  'API pública deve informar tipos de arquivo permitidos para UX amigável.',
)
assert.match(
  publicRouteSource,
  /previewUrl/,
  'API pública deve retornar URL segura de preview para anexos enviados.',
)
assert.match(
  publicRouteSource,
  /downloadUrl/,
  'API pública deve retornar URL segura de download para anexos enviados.',
)
assert.match(
  publicRouteSource,
  /requiredPending/,
  'Conclusão deve retornar itens obrigatórios pendentes quando inválida.',
)
assert.match(
  publicRouteSource,
  /Formato inválido\. Envie PDF, JPG, PNG, DOC ou DOCX\./,
  'Upload deve rejeitar formatos inválidos com mensagem clara.',
)

assert.match(
  publicAttachmentRouteSource,
  /toTokenHash\(token\)/,
  'Rota pública de anexo deve validar token da solicitação antes de liberar arquivo.',
)
assert.match(
  publicAttachmentRouteSource,
  /solicitationId: solicitation\.id/,
  'Rota pública de anexo deve restringir acesso ao mesmo processo da solicitação.',
)

assert.match(
  publicPageSource,
  /Envio de documentos para admissão/,
  'Página pública deve exibir cabeçalho claro para o candidato externo.',
)
assert.match(
  publicPageSource,
  /Progresso dos obrigatórios/,
  'Página pública deve mostrar progresso visual de documentos obrigatórios.',
)
assert.match(
  publicPageSource,
  /Visualizar/,
  'Página pública deve permitir pré-visualização de arquivos enviados.',
)
assert.match(
  publicPageSource,
  /Pendentes obrigatórios:/,
  'Página pública deve destacar resumo de pendências antes de concluir.',
)
assert.match(
  publicPageSource,
  /Documentos enviados com sucesso/,
  'Página pública deve apresentar tela de sucesso após conclusão.',
)

console.log('✅ external-admission-email-public-flow.test passed')
