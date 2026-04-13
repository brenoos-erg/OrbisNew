export const dynamic = 'force-dynamic'
export const revalidate = 0

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { notifySolicitationEvent } from '@/lib/solicitationOperationalNotifications'
import { isViewerOnlyForSolicitation } from '@/lib/solicitationPermissionGuards'
import { canFinalizeSolicitation, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'
import {
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation'
import { isSolicitacaoNadaConsta } from '@/lib/solicitationTypes'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params

    const isViewerOnly = await isViewerOnlyForSolicitation({ solicitationId: id, userId: me.id })
    if (isViewerOnly) {
      return NextResponse.json({ error: 'Usuário visualizador não pode executar esta ação.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const observacao = typeof body?.observacao === 'string' ? body.observacao.trim() : ''
    const existeTermoBody = typeof body?.existeTermoParaAnexar === 'string'
      ? body.existeTermoParaAnexar.trim().toUpperCase()
      : ''


     const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, code: true } },
        tipo: {
          select: {
            id: true,
            nome: true,
            schemaJson: true,
          },
        },
        solicitacaoSetores: { select: { setor: true, status: true, constaFlag: true } },
        comentarios: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        anexos: { select: { filename: true } },
        documents: { select: { type: true, pdfUrl: true, signedPdfUrl: true } },
      },
    })


    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json({ error: 'Solicitação já encerrada.' }, { status: 400 })
    }

    if (
      solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
      solicitation.status !== EXPERIENCE_EVALUATION_FINALIZATION_STATUS
    ) {
      return NextResponse.json(
        { error: 'A avaliação de experiência só pode ser finalizada após conclusão do gestor e retorno ao RH.' },
        { status: 400 },
      )
    }

     const departamentos = Array.isArray((solicitation.tipo?.schemaJson as any)?.meta?.departamentos)
      ? ((solicitation.tipo?.schemaJson as any).meta.departamentos as unknown[])
          .filter((item): item is string => typeof item === 'string')
      : []
    const departamentoFinal = departamentos.length > 0 ? departamentos[departamentos.length - 1] : null
    const isUltimaEtapa =
      departamentos.length <= 1 ||
      (departamentoFinal !== null && solicitation.departmentId === departamentoFinal)

   const isNadaConsta = isSolicitacaoNadaConsta({ id: solicitation.tipo?.id, nome: solicitation.tipo?.nome })
    if (isNadaConsta && !observacao) {
      return NextResponse.json(
        { error: 'Para finalizar Nada Consta, a observação é obrigatória.' },
        { status: 400 },
      )
    }

    const payloadCampos = (((solicitation.payload ?? {}) as Record<string, any>).campos ?? {}) as Record<string, unknown>
    const isSolicitacaoEquipamento =
      solicitation.tipo?.id === 'SOLICITACAO_EQUIPAMENTO' ||
      solicitation.tipo?.id === 'RQ_089' ||
      solicitation.tipo?.nome === 'SOLICITAÇÃO DE EQUIPAMENTO'
    const existeTermoParaAnexar = existeTermoBody || String(payloadCampos.existeTermoParaAnexar ?? '').trim().toUpperCase()
    const hasTermoAnexo = solicitation.anexos.some((anexo) => anexo.filename.toLowerCase().includes('termo'))
    const hasTermoDocumento = solicitation.documents.some(
      (doc) => doc.type === 'TERMO_RESPONSABILIDADE' && Boolean(doc.pdfUrl || doc.signedPdfUrl),
    )
    if (isSolicitacaoEquipamento && existeTermoParaAnexar === 'SIM' && !hasTermoAnexo && !hasTermoDocumento) {
      return NextResponse.json(
        { error: 'Existe termo para anexar = SIM. É obrigatório anexar/gerar o termo antes de finalizar.' },
        { status: 400 },
      )
    }
    const todosSetoresVerdes =
      solicitation.solicitacaoSetores.length > 0 &&
      solicitation.solicitacaoSetores.every((setor) => setor.status === 'CONCLUIDO' && Boolean(setor.constaFlag))

    const dpPodeFinalizarExcecao =
      me.role === 'DP' &&
      (solicitation.department?.code === '08' || solicitation.assumidaPorId === me.id)

    if (!isUltimaEtapa && !(isNadaConsta && todosSetoresVerdes) && !dpPodeFinalizarExcecao) {
      return NextResponse.json(
        { error: 'Só é possível finalizar chamados na última etapa do fluxo.' },
        { status: 400 },
      )
    }

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    })

    const canFinalize = canFinalizeSolicitation(userAccess, {
      tipoId: solicitation.tipoId,
      status: solicitation.status,
      solicitanteId: solicitation.solicitanteId,
      approverId: solicitation.approverId,
      assumidaPorId: solicitation.assumidaPorId,
      departmentId: solicitation.departmentId,
      solicitacaoSetores: solicitation.solicitacaoSetores,
    })

    if (!canFinalize && !dpPodeFinalizarExcecao) {
      return NextResponse.json(
        { error: 'Você não pode finalizar solicitações desta etapa/departamento.' },
        { status: 403 },
      )
    }
    const now = new Date()

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: 'CONCLUIDA',
        dataFechamento: now,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'CONCLUIDA',
        message: 'Solicitação finalizada na última etapa do fluxo.',
      },
    })
    if (observacao) {
      await prisma.comment.create({
        data: {
          id: randomUUID(),
          solicitationId: id,
          autorId: me.id,
          texto: observacao,
        },
      })
    }

    await prisma.event.create({
      data: {
        id: randomUUID(),
        solicitationId: id,
        actorId: me.id,
        tipo: 'FINALIZADA',
      },
    })

    await notifySolicitationEvent({
      solicitationId: id,
      event: 'FINALIZED',
      actorName: me.fullName ?? me.id,
      dedupeKey: `FINALIZED:${id}`,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/solicitacoes/[id]/finalizar error', error)
    return NextResponse.json({ error: 'Erro ao finalizar solicitação.' }, { status: 500 })
  }
}