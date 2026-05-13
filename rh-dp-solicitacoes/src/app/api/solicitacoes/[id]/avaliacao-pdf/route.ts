export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  hasExperienceEvaluationPrintableData,
  isExperienceEvaluationTipoLike,
  normalizeExperienceEvaluationPayload,
} from '@/lib/experienceEvaluation'
import {
  canPrintExperienceEvaluationPdf,
  resolveUserAccessContext,
} from '@/lib/solicitationAccessPolicy'
import {
  buildExperienceEvaluationPdfFilename,
  generateExperienceEvaluationPdfBuffer,
} from '@/lib/pdf/experienceEvaluationPdf'

function isAllowedExperienceEvaluationPdfStatus(status: string | null | undefined, payload: unknown) {
  if (status === 'CANCELADA') return false
  return (
    status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS ||
    status === 'CONCLUIDA' ||
    status === 'FINALIZADA' ||
    hasExperienceEvaluationPrintableData(payload)
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        tipo: { select: { id: true, codigo: true, nome: true } },
        solicitante: { select: { fullName: true } },
        approver: { select: { id: true, fullName: true } },
        assumidaPor: { select: { id: true, fullName: true } },
        comentarios: { select: { id: true }, take: 1 },
        timelines: { select: { id: true }, take: 1 },
        solicitacaoSetores: { select: { setor: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (
      !isExperienceEvaluationTipoLike({
        id: solicitation.tipo?.id ?? solicitation.tipoId,
        codigo: solicitation.tipo?.codigo,
        nome: solicitation.tipo?.nome,
      })
    ) {
      return NextResponse.json(
        { error: 'PDF disponível somente para Avaliação do Período de Experiência.' },
        { status: 400 },
      )
    }

    if (solicitation.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Esta avaliação foi cancelada e não pode ser impressa.' },
        { status: 400 },
      )
    }

    if (!isAllowedExperienceEvaluationPdfStatus(solicitation.status, solicitation.payload)) {
      return NextResponse.json(
        {
          error:
            'PDF disponível somente para avaliações finalizadas ou com dados de avaliação preenchidos.',
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
    const pdf = await generateExperienceEvaluationPdfBuffer({
      protocolo: solicitation.protocolo,
      solicitanteNome: solicitation.solicitante.fullName,
      tipoNome: solicitation.tipo?.nome ?? 'Avaliação do Período de Experiência',
      evaluation,
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${buildExperienceEvaluationPdfFilename(solicitation.protocolo)}"`,
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
  }
}
