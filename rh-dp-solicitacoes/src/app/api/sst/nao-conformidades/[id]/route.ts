import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityApprovalStatus, NonConformityStatus, NonConformityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { canManageAllNc, isApproved, shouldSetClosedAt } from '@/lib/sst/nonConformity'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nc = await prisma.nonConformity.findUnique({
      where: { id: (await params).id },
      include: {
        planoDeAcao: { include: { responsavel: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
        estudoCausa: { orderBy: { ordem: 'asc' } },
        anexos: { orderBy: { createdAt: 'desc' } },
        comentarios: { include: { autor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        timeline: { include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        centroQueDetectou: { select: { id: true, description: true } },
        centroQueOriginou: { select: { id: true, description: true } },
        aprovadoQualidadePor: { select: { id: true, fullName: true, email: true } },
        verificacaoEficaciaAprovadoPor: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2) && nc.solicitanteId !== me.id) {
      return NextResponse.json({ error: 'Você só pode visualizar as suas não conformidades.' }, { status: 403 })
    }

    return NextResponse.json({ item: nc })
  } catch (error) {
    console.error('GET /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao carregar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Permissão insuficiente para editar.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const id = (await params).id
    const current = await prisma.nonConformity.findUnique({
      where: { id },
      select: { id: true, status: true, solicitanteId: true, aprovadoQualidadeStatus: true },
    })
    if (!current) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

    const isOwner = current.solicitanteId === me.id
    if (!isOwner && !hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Sem permissão para editar esta NC.' }, { status: 403 })
    }

    const approved = isApproved(current.aprovadoQualidadeStatus)
    const nextStatus = body?.status as NonConformityStatus | undefined
    if (nextStatus && !Object.values(NonConformityStatus).includes(nextStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    if (!approved) {
      const onlyBasic = ['descricao', 'evidenciaObjetiva']
      const touched = Object.keys(body).filter((key) => body[key] !== undefined)
      if (touched.some((key) => !onlyBasic.includes(key))) {
        return NextResponse.json({ error: 'Antes da aprovação da qualidade só é permitido editar descrição e evidência objetiva.' }, { status: 403 })
      }
    }

    if (nextStatus === NonConformityStatus.ENCERRADA && !canManageAllNc(level)) {
      return NextResponse.json({ error: 'Somente nível 3 pode encerrar.' }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.nonConformity.update({
        where: { id },
        data: {
          status: nextStatus,
          tipoNc: body?.tipoNc && Object.values(NonConformityType).includes(body.tipoNc) ? body.tipoNc : undefined,
          descricao: body?.descricao !== undefined ? String(body.descricao).trim() : undefined,
          evidenciaObjetiva: body?.evidenciaObjetiva !== undefined ? String(body.evidenciaObjetiva).trim() : undefined,
          referenciaSig: body?.referenciaSig !== undefined ? (body.referenciaSig ? String(body.referenciaSig).trim() : null) : undefined,
          acoesImediatas: body?.acoesImediatas !== undefined ? (body.acoesImediatas ? String(body.acoesImediatas).trim() : null) : undefined,
          causaRaiz: body?.causaRaiz !== undefined ? (body.causaRaiz ? String(body.causaRaiz).trim() : null) : undefined,
          gravidade: body?.gravidade !== undefined ? Number(body.gravidade) : undefined,
          urgencia: body?.urgencia !== undefined ? Number(body.urgencia) : undefined,
          tendencia: body?.tendencia !== undefined ? Number(body.tendencia) : undefined,
          fechamentoEm: shouldSetClosedAt(nextStatus) ? new Date() : undefined,
        },
      })

      await tx.nonConformityTimeline.create({
        data: {
          nonConformityId: id,
          actorId: me.id,
          tipo: nextStatus && nextStatus !== current.status ? 'STATUS_CHANGE' : 'ATUALIZACAO',
          fromStatus: nextStatus && nextStatus !== current.status ? current.status : undefined,
          toStatus: nextStatus && nextStatus !== current.status ? nextStatus : undefined,
          message: nextStatus && nextStatus !== current.status ? `Status alterado para ${nextStatus}` : 'Não conformidade atualizada',
        },
      })

      return item
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao atualizar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}