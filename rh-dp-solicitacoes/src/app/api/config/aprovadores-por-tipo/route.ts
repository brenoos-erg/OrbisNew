import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, Role, TipoApproverRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_1)

    const [tipos, users] = await Promise.all([
      prisma.tipoSolicitacao.findMany({
        select: {
          id: true,
          codigo: true,
          nome: true,
          approvers: {
            select: {
              userId: true,
              role: true,
              user: { select: { id: true, fullName: true, email: true, status: true } },
            },
            orderBy: [{ role: 'asc' }, { user: { fullName: 'asc' } }],
          },
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          status: 'ATIVO',
          moduleAccesses: { some: { module: { key: 'solicitacoes' } } },
        },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      }),
    ])

    return NextResponse.json({ tipos, users })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao carregar aprovadores.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    if (me.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Somente administrador pode alterar aprovadores.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as
      | { tipoId?: string; approvers?: string[]; viewers?: string[] }
      | null

    const tipoId = body?.tipoId?.trim()
    const approvers = Array.from(new Set((body?.approvers ?? []).filter(Boolean)))
    const viewers = Array.from(new Set((body?.viewers ?? []).filter(Boolean))).filter((id) => !approvers.includes(id))

    if (!tipoId) {
      return NextResponse.json({ error: 'tipoId é obrigatório.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.tipoSolicitacaoApprover.deleteMany({ where: { tipoId } })

      const data = [
        ...approvers.map((userId) => ({ tipoId, userId, role: TipoApproverRole.APPROVER })),
        ...viewers.map((userId) => ({ tipoId, userId, role: TipoApproverRole.VIEWER })),
      ]

      if (data.length > 0) {
        await tx.tipoSolicitacaoApprover.createMany({
          data,
          skipDuplicates: true,
        })
      }
    })

    return GET()
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao salvar aprovadores.' }, { status: 500 })
  }
}