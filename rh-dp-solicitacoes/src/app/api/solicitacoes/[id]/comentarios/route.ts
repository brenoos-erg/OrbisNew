import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { resolveNadaConstaSetoresByDepartment } from '@/lib/solicitationTypes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.texto === 'string' ? body.texto.trim() : ''

    if (!text) {
      return NextResponse.json(
        { error: 'Informe a observação para registrar o comentário.' },
        { status: 400 },
      )
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      select: {
        id: true,
        status: true,
        costCenterId: true,
        departmentId: true,
        approverId: true,
        assumidaPorId: true,
        solicitanteId: true,
        solicitacaoSetores: { select: { setor: true } },
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (solicitation.status === 'CONCLUIDA' || solicitation.status === 'CANCELADA') {
      return NextResponse.json(
        { error: 'Não é possível adicionar observações em solicitações finalizadas ou canceladas.' },
        { status: 400 },
      )
    }

    const [costCenterLinks, departmentLinks] = await Promise.all([
      prisma.userCostCenter.findMany({ where: { userId: me.id }, select: { costCenterId: true } }),
      prisma.userDepartment.findMany({
        where: { userId: me.id },
        select: { departmentId: true, department: { select: { code: true, name: true } } },
      }),
    ])

    const ccIds = new Set<string>()
    const deptIds = new Set<string>()

    if (me.costCenterId) ccIds.add(me.costCenterId)
    if (me.departmentId) deptIds.add(me.departmentId)
    for (const link of costCenterLinks) ccIds.add(link.costCenterId)
    for (const link of departmentLinks) deptIds.add(link.departmentId)

    const setorKeys = new Set<string>()
    for (const setor of resolveNadaConstaSetoresByDepartment(me.department)) {
      setorKeys.add(setor)
    }
    for (const link of departmentLinks) {
      for (const setor of resolveNadaConstaSetoresByDepartment(link.department)) {
        setorKeys.add(setor)
      }
    }

    const canComment =
      me.role === 'ADMIN' ||
      solicitation.solicitanteId === me.id ||
      solicitation.assumidaPorId === me.id ||
      solicitation.approverId === me.id ||
      Boolean(solicitation.costCenterId && ccIds.has(solicitation.costCenterId)) ||
      Boolean(solicitation.departmentId && deptIds.has(solicitation.departmentId)) ||
      solicitation.solicitacaoSetores.some((setor) => setorKeys.has(setor.setor))

    if (!canComment) {
      return NextResponse.json(
        { error: 'Você não possui permissão para registrar observações nesta solicitação.' },
        { status: 403 },
      )
    }

    await prisma.comment.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        autorId: me.id,
        texto: text,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: solicitation.status,
        message: `Observação registrada por ${me.fullName ?? me.id}: ${text}`,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/comentarios error', error)
    return NextResponse.json(
      { error: 'Erro ao registrar observação da solicitação.' },
      { status: 500 },
    )
  }
}