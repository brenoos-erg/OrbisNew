export const dynamic = 'force-dynamic'
export const revalidate = 0

import { chromium } from 'playwright'
import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'
import { canFinalizeSolicitation, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'

function escapeHtml(input: unknown) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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

    if (
      solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID ||
      solicitation.status !== EXPERIENCE_EVALUATION_FINALIZATION_STATUS
    ) {
      return NextResponse.json(
        { error: 'PDF disponível apenas na etapa final da Avaliação do Período de Experiência.' },
        { status: 400 },
      )
    }

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    const canDownload = canFinalizeSolicitation(userAccess, {
      tipoId: solicitation.tipoId,
      status: solicitation.status,
      solicitanteId: solicitation.solicitanteId,
      approverId: solicitation.approverId,
      assumidaPorId: solicitation.assumidaPorId,
      departmentId: solicitation.departmentId,
      solicitacaoSetores: solicitation.solicitacaoSetores,
    })

    if (!canDownload) {
      return NextResponse.json(
        { error: 'Somente RH (ou admin) pode gerar o PDF na etapa final.' },
        { status: 403 },
      )
    }

    const payload = (solicitation.payload ?? {}) as Record<string, any>
    const campos = (payload.campos ?? {}) as Record<string, any>
    const avaliacao = (payload.avaliacaoGestor ?? {}) as Record<string, any>
    const rows = [
      ['Colaborador avaliado', campos.colaboradorAvaliado],
      ['Contrato / setor', campos.contratoSetor],
      ['Cargo do colaborador', campos.cargoColaborador],
      ['Data de admissão', campos.dataAdmissao],
      ['Gestor avaliador', campos.gestorImediatoAvaliador],
      ['Relacionamento', avaliacao.relacionamentoNota],
      ['Comunicação', avaliacao.comunicacaoNota],
      ['Atitude', avaliacao.atitudeNota],
      ['Saúde e segurança', avaliacao.saudeSegurancaNota],
      ['Domínio técnico e processos', avaliacao.dominioTecnicoProcessosNota],
      ['Adaptação à mudança', avaliacao.adaptacaoMudancaNota],
      ['Autogestão e gestão de pessoas', avaliacao.autogestaoGestaoPessoasNota],
      ['Comentário final', avaliacao.comentarioFinal],
      ['Avaliado em', avaliacao.avaliadoEm],
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
                `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
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
