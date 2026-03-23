export const dynamic = 'force-dynamic'
export const revalidate = 0

import { chromium } from 'playwright'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  listExperienceEvaluators,
} from '@/lib/experienceEvaluation'
import { resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'

function escapeHtml(input: unknown) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function toDisplayValue(input: unknown) {
  if (input === null || input === undefined) return ''
  if (typeof input === 'string') return input.trim()
  if (typeof input === 'number' || typeof input === 'boolean') return String(input)
  if (Array.isArray(input)) return input.filter(Boolean).map((item) => String(item)).join(', ')
  return String(input)
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
        tipo: { select: { nome: true, schemaJson: true } },
        solicitante: { select: { fullName: true } },
        solicitacaoSetores: { select: { setor: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    const isExperienceEvaluation = solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID
    const isAllowedStatus =
      solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS ||
      solicitation.status === 'CONCLUIDA'

    if (!isExperienceEvaluation || !isAllowedStatus) {
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
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    const canDownload =
      me.role === 'ADMIN' ||
      (Boolean(solicitation.departmentId) &&
        userAccess.userDepartmentIds.includes(solicitation.departmentId as string))

    if (!canDownload) {
      return NextResponse.json(
        { error: 'Somente RH (ou admin) pode gerar o PDF na etapa final e após conclusão.' },
        { status: 403 },
      )
    }

     const payload = (solicitation.payload ?? {}) as Record<string, any>
    const campos = ((payload.campos ?? payload.formData ?? payload.dadosFormulario ?? {}) ??
      {}) as Record<string, any>
    const avaliacao = (payload.avaliacaoGestor ?? {}) as Record<string, any>
    let gestorAvaliador = toDisplayValue(campos.gestorImediatoAvaliador)

    if (!gestorAvaliador && toDisplayValue(campos.gestorImediatoAvaliadorId)) {
      const coordenadores = await listExperienceEvaluators()
      gestorAvaliador =
        coordenadores.find((coordenador) => coordenador.id === campos.gestorImediatoAvaliadorId)
          ?.fullName ?? ''
    }

    const baseRows: Array<[string, string]> = [
      ['Colaborador avaliado', toDisplayValue(campos.colaboradorAvaliado)],
      ['Contrato / setor', toDisplayValue(campos.contratoSetor)],
      ['Gestor imediato avaliador', gestorAvaliador],
      ['Cargo do colaborador', toDisplayValue(campos.cargoColaborador)],
      ['Data de admissão', toDisplayValue(campos.dataAdmissao)],
      ['Cargo do avaliador', toDisplayValue(campos.cargoAvaliador)],
      ['Relacionamento', toDisplayValue(avaliacao.relacionamentoNota)],
      ['Comunicação', toDisplayValue(avaliacao.comunicacaoNota)],
      ['Atitude', toDisplayValue(avaliacao.atitudeNota)],
      ['Saúde e segurança', toDisplayValue(avaliacao.saudeSegurancaNota)],
      [
        'Domínio técnico e processos',
        toDisplayValue(avaliacao.dominioTecnicoProcessosNota),
      ],
      ['Adaptação à mudança', toDisplayValue(avaliacao.adaptacaoMudancaNota)],
      [
        'Autogestão e gestão de pessoas',
        toDisplayValue(avaliacao.autogestaoGestaoPessoasNota),
      ],
      ['Comentário final', toDisplayValue(avaliacao.comentarioFinal)],
      ['Avaliado em', toDisplayValue(avaliacao.avaliadoEm)],
    ]

    const schemaFields = (
      (solicitation.tipo?.schemaJson as { camposEspecificos?: Array<{ name?: string; label?: string }> })
        ?.camposEspecificos ?? []
    )
      .filter((field) => field?.name && field?.label)
      .map((field) => ({ name: String(field.name), label: String(field.label) }))

    const includedFieldNames = new Set([
      'colaboradorAvaliado',
      'contratoSetor',
      'gestorImediatoAvaliador',
      'cargoColaborador',
      'dataAdmissao',
      'cargoAvaliador',
    ])

   const dynamicRows: Array<[string, string]> = schemaFields
      .filter((field) => !includedFieldNames.has(field.name))
      .map<[string, string]>((field) => [field.label, toDisplayValue(campos[field.name])])
      .filter(([, value]) => Boolean(value))

    const rows = [...baseRows, ...dynamicRows]
    const hasAnyDataRow = rows.some(([, value]) => Boolean(value))

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
                `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
            )
            .join('')}
        </table>
        ${
          hasAnyDataRow
            ? ''
            : '<p style="margin-top:16px;font-size:12px;color:#64748b">Sem dados preenchidos para exibir no momento da geração.</p>'
        }
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
