import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { id, actionId } = await params

    const nc = await prisma.nonConformity.findUnique({
      where: { id },
      select: {
        id: true,
        numeroRnc: true,
        gravidade: true,
        urgencia: true,
        tendencia: true,
        aprovadoQualidadeStatus: true,
        solicitanteId: true,
        solicitante: { select: { id: true, fullName: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (!hasMinLevel(level, ModuleLevel.NIVEL_2) && nc.solicitanteId !== me.id) {
      return NextResponse.json({ error: 'Você só pode visualizar as suas não conformidades.' }, { status: 403 })
    }

    const action = await prisma.nonConformityActionItem.findUnique({
      where: { id: actionId },
      include: {
        responsavel: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!action || action.nonConformityId !== id) {
      return NextResponse.json({ error: 'Ação não encontrada para esta não conformidade.' }, { status: 404 })
    }

    const timelineOrFilters: Array<{ message: { contains: string } }> = [{ message: { contains: actionId } }]
    if (action.descricao?.trim()) timelineOrFilters.push({ message: { contains: action.descricao.trim() } })

    const timeline = await prisma.nonConformityTimeline.findMany({
      where: {
        nonConformityId: id,
        OR: timelineOrFilters,
      },
      include: { actor: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })

    return NextResponse.json({
      item: {
        action,
        nonConformity: nc,
        editable: nc.aprovadoQualidadeStatus === 'APROVADO' && (nc.solicitanteId === me.id || hasMinLevel(level, ModuleLevel.NIVEL_2)),
        timeline,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}