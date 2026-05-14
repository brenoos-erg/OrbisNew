export const dynamic = 'force-dynamic'
export const revalidate = 0

import { chromium } from 'playwright'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  hasExperienceEvaluationPrintableData,
  normalizeExperienceEvaluationPayload,
} from '@/lib/experienceEvaluation'
import {
  canPrintExperienceEvaluationPdf,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'

function escapeHtml(input: unknown) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function toPdfDisplayValue(input: unknown) {
  if (input === null || input === undefined) return '-'
  const value = String(input).trim()
  return value || '-'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    const me = await requireActiveUser()
    const { id } = await params

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        tipo: { select: { nome: true } },
        solicitante: { select: { fullName: true } },
        solicitacaoSetores: { select: { setor: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) {
      return NextResponse.json(
        { error: 'PDF disponível somente para Avaliação do Período de Experiência.' },
        { status: 400 },
      )
    }

    if (solicitation.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'A avaliação cancelada não pode ser impressa.' },
        { status: 400 },
      )
    }

    const isAllowedStatus =
      [EXPERIENCE_EVALUATION_FINALIZATION_STATUS, 'CONCLUIDA', 'FINALIZADA'].includes(String(solicitation.status))

    if (!isAllowedStatus) {
      return NextResponse.json(
        {
          error:
            'PDF disponível somente na etapa final da Avaliação do Período de Experiência e após conclusão.',
        },
        { status: 400 },
      )
    }

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    if (!canPrintExperienceEvaluationPdf(userAccess, solicitation)) {
      return NextResponse.json(
        { error: 'Você não tem permissão para imprimir esta avaliação.' },
        { status: 403 },
      )
    }

    if (!hasExperienceEvaluationPrintableData(solicitation.payload)) {
      return NextResponse.json(
        { error: 'A avaliação ainda não possui dados suficientes para impressão.' },
        { status: 400 },
      )
    }

    const evaluation = normalizeExperienceEvaluationPayload(solicitation.payload)

    const rows: Array<[string, string]> = [
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
      ['Avaliado/finalizado em', evaluation.avaliadoEm],
    ]

    const html = `<!doctype html>
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
          <div><strong>Protocolo:</strong> ${escapeHtml(solicitation.protocolo)}</div>
          <div><strong>Solicitante:</strong> ${escapeHtml(solicitation.solicitante.fullName)}</div>
          <div><strong>Tipo:</strong> ${escapeHtml(solicitation.tipo?.nome ?? '')}</div>
        </div>
        <table>
          ${rows
            .map(
              ([label, value]) =>
                `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(toPdfDisplayValue(value))}</td></tr>`,
            )
            .join('')}
        </table>
      </body>
      </html>`
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="avaliacao-experiencia-${solicitation.protocolo}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('GET /api/solicitacoes/[id]/avaliacao-pdf error', error)
    const details = String(error?.message ?? '')
    if (details.toLowerCase().includes('executable')) {
      return NextResponse.json(
        {
          error: 'Chromium do Playwright não está disponível para gerar o PDF nesta instância.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'Erro ao gerar PDF da avaliação.' }, { status: 500 })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
