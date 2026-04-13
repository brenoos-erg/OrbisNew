import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_REQUIRED_FIELDS,
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  isExperienceEvaluationEvaluator,
  resolveRhDepartmentForExperienceEvaluation,
} from '@/lib/experienceEvaluation'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => null)

   const avaliacao = {
      relacionamentoNota:
        typeof body?.relacionamentoNota === 'string'
          ? body.relacionamentoNota.trim()
          : '',
      comunicacaoNota:
        typeof body?.comunicacaoNota === 'string' ? body.comunicacaoNota.trim() : '',
      atitudeNota: typeof body?.atitudeNota === 'string' ? body.atitudeNota.trim() : '',
      saudeSegurancaNota:
        typeof body?.saudeSegurancaNota === 'string'
          ? body.saudeSegurancaNota.trim()
          : '',
      dominioTecnicoProcessosNota:
        typeof body?.dominioTecnicoProcessosNota === 'string'
          ? body.dominioTecnicoProcessosNota.trim()
          : '',
      adaptacaoMudancaNota:
        typeof body?.adaptacaoMudancaNota === 'string'
          ? body.adaptacaoMudancaNota.trim()
          : '',
      autogestaoGestaoPessoasNota:
        typeof body?.autogestaoGestaoPessoasNota === 'string'
          ? body.autogestaoGestaoPessoasNota.trim()
          : '',
      comentarioFinal:
        typeof body?.comentarioFinal === 'string' ? body.comentarioFinal.trim() : '',
    }

    const missingFields = EXPERIENCE_EVALUATION_REQUIRED_FIELDS.filter((field) => {
      const value = avaliacao[field]
      return !value || !String(value).trim()
    })

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Preencha todos os campos da avaliação.',
          missingFields,
        },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({ where: { id } })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) {
      return NextResponse.json(
        { error: 'Tipo de solicitação não suportado para avaliação do gestor.' },
        { status: 400 },
      )
    }

     if (
      !isExperienceEvaluationEvaluator(
        { payload: solicitation.payload, approverId: solicitation.approverId },
        me,
      )
    ) {
      return NextResponse.json(
        { error: 'Somente o gestor imediato avaliador pode preencher esta etapa.' },
        { status: 403 },
      )
    }


    if ((solicitation.status as string) !== EXPERIENCE_EVALUATION_STATUS) {
      return NextResponse.json(
        { error: 'Solicitação não está aguardando avaliação do gestor.' },
        { status: 400 },
      )
    }

     const payload = (solicitation.payload ?? {}) as Record<string, any>
    const rhRouting = await resolveRhDepartmentForExperienceEvaluation()
    if (!rhRouting?.departmentId) {
      return NextResponse.json(
        { error: 'Não foi possível identificar o departamento do RH para concluir este fluxo.' },
        { status: 400 },
      )
    }

    const updatedPayload = {
      ...payload,
      avaliacaoGestor: {
        ...avaliacao,
        avaliadoEm: new Date().toISOString(),
        avaliadorId: me.id,
      },
    }

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        payload: updatedPayload,
        status: EXPERIENCE_EVALUATION_FINALIZATION_STATUS as any,
        dataFechamento: null,
        departmentId: rhRouting.departmentId,
        ...(rhRouting.costCenterId ? { costCenterId: rhRouting.costCenterId } : {}),
        assumidaPorId: null,
        assumidaEm: null,
        approverId: null,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: EXPERIENCE_EVALUATION_FINALIZATION_STATUS as any,
        message: 'Avaliação do gestor concluída. Solicitação devolvida ao RH para emissão de PDF e finalização.',
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'AVALIACAO_GESTOR_CONCLUIDA',
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/avaliacao-gestor error', error)
    return NextResponse.json(
      { error: 'Erro ao salvar avaliação do gestor.' },
      { status: 500 },
    )
  }
}