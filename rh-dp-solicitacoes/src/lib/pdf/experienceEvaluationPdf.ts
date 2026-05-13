import { chromium } from 'playwright'
import type { NormalizedExperienceEvaluationPayload } from '@/lib/experienceEvaluation.shared'

export const URGENT_EXPERIENCE_EVALUATION_PROTOCOLS = [
  'RQ2026-00203',
  'RQ2026-00210',
  'RQ2026-00657',
  'RQ2026-00755',
  'RQ2026-00763',
  'RQ2026-00764',
  'RQ2026-00800',
] as const

export function buildExperienceEvaluationPdfFilename(protocolo: string) {
  return `avaliacao-periodo-experiencia-${protocolo}.pdf`
}

export function escapeExperienceEvaluationPdfHtml(input: unknown) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function toExperienceEvaluationPdfDisplayValue(input: unknown) {
  if (input === null || input === undefined) return '-'
  const value = String(input).trim()
  return value || '-'
}

export function buildExperienceEvaluationPdfRows(evaluation: NormalizedExperienceEvaluationPayload) {
  return [
    ['Colaborador avaliado', evaluation.colaboradorAvaliado],
    ['Contrato / setor', evaluation.contratoSetor],
    ['Gestor imediato avaliador', evaluation.gestorImediatoAvaliador],
    ['Cargo do colaborador', evaluation.cargoColaborador],
    ['Data de admissão', evaluation.dataAdmissao],
    ['Cargo do avaliador', evaluation.cargoAvaliador],
    ['Relacionamento', evaluation.relacionamentoNota],
    ['Comunicação', evaluation.comunicacaoNota],
    ['Atitude', evaluation.atitudeNota],
    ['Saúde e segurança', evaluation.saudeSegurancaNota],
    ['Domínio técnico e processos', evaluation.dominioTecnicoProcessosNota],
    ['Adaptação à mudança', evaluation.adaptacaoMudancaNota],
    ['Autogestão e gestão de pessoas', evaluation.autogestaoGestaoPessoasNota],
    ['Comentário final', evaluation.comentarioFinal],
    ['Avaliado em', evaluation.avaliadoEm],
  ] satisfies Array<[string, string]>
}

export function buildExperienceEvaluationPdfHtml(input: {
  protocolo: string
  solicitanteNome: string
  tipoNome: string
  evaluation: NormalizedExperienceEvaluationPayload
}) {
  const rows = buildExperienceEvaluationPdfRows(input.evaluation)

  return `<!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1 { margin: 0 0 4px 0; font-size: 20px; }
        .meta { margin-bottom: 18px; color: #334155; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; vertical-align: top; }
        th { background: #f1f5f9; width: 35%; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Avaliação do Período de Experiência</h1>
      <div class="meta">
        <div><strong>Protocolo:</strong> ${escapeExperienceEvaluationPdfHtml(input.protocolo)}</div>
        <div><strong>Solicitante:</strong> ${escapeExperienceEvaluationPdfHtml(input.solicitanteNome)}</div>
        <div><strong>Tipo:</strong> ${escapeExperienceEvaluationPdfHtml(input.tipoNome)}</div>
      </div>
      <table>
        ${rows
          .map(
            ([label, value]) =>
              `<tr><th>${escapeExperienceEvaluationPdfHtml(label)}</th><td>${escapeExperienceEvaluationPdfHtml(toExperienceEvaluationPdfDisplayValue(value))}</td></tr>`,
          )
          .join('')}
      </table>
    </body>
    </html>`
}

export async function generateExperienceEvaluationPdfBuffer(input: {
  protocolo: string
  solicitanteNome: string
  tipoNome: string
  evaluation: NormalizedExperienceEvaluationPayload
}) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.setContent(buildExperienceEvaluationPdfHtml(input), { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return Buffer.from(pdf)
  } finally {
    if (browser) await browser.close()
  }
}
