import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionStatus, NonConformityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

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
        anexos: { orderBy: { createdAt: 'desc' } },
        comentarios: { include: { autor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        timeline: { include: { actor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        responsavelTratativa: { select: { id: true, fullName: true, email: true } },
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
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Permissão insuficiente para editar.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const {
      status,
      local,
      descricao,
      acaoImediata,
      dataAcaoImediata,
      causaRaiz,
      responsavelTratativaId,
      classificacao,
      origem,
      tipo,
      data,
      updateActionItems,
    } = body

    const id = (await params).id
    const current = await prisma.nonConformity.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!current) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

    const nextStatus = status as NonConformityStatus | undefined
    if (nextStatus && !Object.values(NonConformityStatus).includes(nextStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }
    if (nextStatus === NonConformityStatus.ENCERRADA && !hasMinLevel(level, ModuleLevel.NIVEL_3)) {
      return NextResponse.json({ error: 'Somente nível 3 pode encerrar.' }, { status: 403 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.nonConformity.update({
        where: { id },
        data: {
          status: nextStatus,
          local: local !== undefined ? String(local).trim() : undefined,
          descricao: descricao !== undefined ? String(descricao).trim() : undefined,
          acaoImediata: acaoImediata !== undefined ? String(acaoImediata).trim() : undefined,
          dataAcaoImediata: dataAcaoImediata !== undefined ? (dataAcaoImediata ? new Date(dataAcaoImediata) : null) : undefined,
          causaRaiz: causaRaiz !== undefined ? String(causaRaiz).trim() : undefined,
          responsavelTratativaId: responsavelTratativaId !== undefined ? (responsavelTratativaId || null) : undefined,
          classificacao,
          origem,
          tipo,
          dataOcorrencia: data ? new Date(data) : undefined,
        },
        select: { id: true, status: true },
      })

      if (Array.isArray(updateActionItems)) {
        for (const action of updateActionItems) {
          if (!action?.id) continue
          await tx.nonConformityActionItem.update({
            where: { id: String(action.id) },
            data: {
              descricao: action.descricao !== undefined ? String(action.descricao).trim() : undefined,
              responsavelId: action.responsavelId !== undefined ? action.responsavelId || null : undefined,
              responsavelNome: action.responsavelNome !== undefined ? (action.responsavelNome ? String(action.responsavelNome).trim() : null) : undefined,
              prazo: action.prazo !== undefined ? (action.prazo ? new Date(action.prazo) : null) : undefined,
              status: action.status && Object.values(NonConformityActionStatus).includes(action.status)
                ? action.status
                : undefined,
              evidencias: action.evidencias !== undefined ? (action.evidencias ? String(action.evidencias).trim() : null) : undefined,
            },
          })
        }
      }

      if (nextStatus && nextStatus !== current.status) {
        await tx.nonConformityTimeline.create({
          data: {
            nonConformityId: id,
            actorId: me.id,
            tipo: 'STATUS_TRANSITION',
            fromStatus: current.status,
            toStatus: nextStatus,
            message: `Status alterado para ${nextStatus}`,
          },
        })
      }

      return item
    })

   return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/sst/nao-conformidades/[id] error', error)
    return NextResponse.json({ error: 'Erro ao atualizar não conformidade.', detail: devErrorDetail(error) }, { status: 500 })
  }
}