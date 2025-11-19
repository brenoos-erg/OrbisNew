// src/app/api/solicitacoes/[id]/aprovar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel } from '@prisma/client'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser()

    // 🔐 só quem for NIVEL_3 no módulo "solicitacoes" pode aprovar
    await assertUserMinLevel(me.id, 'solicitacoes', ModuleLevel.NIVEL_3)

    const solicitationId = params.id

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    if (
      !solicitation.requiresApproval ||
      solicitation.approvalStatus !== 'PENDENTE'
    ) {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'APROVADO',
        approvalAt: new Date(),
        approverId: me.id,
        status: 'ABERTA',          // volta pro fluxo normal

        // 👇 limpa o atendente depois de aprovar
        // use os nomes exatos do seu schema.prisma
        assumidaPorId: null,
        assumidaEm: null,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'APROVADO',
        message: `Aprovado por ${me.fullName ?? me.id}`,
      },
    })

    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'APROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('❌ erro ao aprovar solicitação', err)

    if (err instanceof Error && err.message.includes('permissão')) {
      return NextResponse.json(
        { error: err.message },
        { status: 403 },
      )
    }

    return NextResponse.json(
      { error: 'Erro ao aprovar solicitação.' },
      { status: 500 },
    )
  }
}
