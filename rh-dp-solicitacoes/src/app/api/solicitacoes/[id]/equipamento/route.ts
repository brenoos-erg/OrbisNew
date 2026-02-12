export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import crypto from 'crypto'
import { isSolicitacaoEquipamento } from '@/lib/solicitationTypes'
import { findLevel3SolicitacoesApprover } from '@/lib/solicitationApprovers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const solicitationId = (await params).id
    const body = (await req.json().catch(() => ({}))) as {
      action?: 'ALOCAR' | 'SEM_ESTOQUE'
      equipmentId?: string
      title?: string
      pdfUrl?: string
      signingProvider?: string
      signingUrl?: string
    }

    const action = body.action
    if (!action || !['ALOCAR', 'SEM_ESTOQUE'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
      include: {
        tipo: true,
      },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!isSolicitacaoEquipamento(solicitation.tipo)) {
      return NextResponse.json(
        { error: 'Esta rota é exclusiva para solicitações de equipamento.' },
        { status: 400 },
      )
    }

    if (action === 'SEM_ESTOQUE') {
      const approver = await findLevel3SolicitacoesApprover()
      const approverId = approver?.id ?? null

      const updated = await prisma.solicitation.update({
        where: { id: solicitation.id },
        data: {
          requiresApproval: true,
          approvalStatus: 'PENDENTE',
          approverId,
          status: 'AGUARDANDO_APROVACAO',
        },
      })

      await prisma.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'AGUARDANDO_APROVACAO',
          message:
            'Solicitação de equipamento sem estoque disponível. Encaminhada para aprovação.',
        },
      })

      await prisma.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'AGUARDANDO_APROVACAO_GESTOR',
        },
      })

      return NextResponse.json(updated)
    }

    if (!body.equipmentId || !body.pdfUrl) {
      return NextResponse.json(
        { error: 'equipmentId e pdfUrl são obrigatórios para alocação.' },
        { status: 400 },
      )
    }

    const equipment = await prisma.tiEquipment.findUnique({
      where: { id: body.equipmentId },
      select: { id: true, status: true, name: true, patrimonio: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipamento não encontrado.' }, { status: 404 })
    }

    if (equipment.status !== 'IN_STOCK') {
      return NextResponse.json(
        { error: 'Somente equipamentos com status IN_STOCK podem ser alocados.' },
        { status: 409 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.tiEquipment.update({
        where: { id: equipment.id },
        data: {
          status: 'ASSIGNED',
          userId: solicitation.solicitanteId,
        },
      })

      const document = await tx.document.create({
        data: {
          solicitationId: solicitation.id,
          type: 'TERMO_RESPONSABILIDADE',
          title:
            body.title?.trim() ||
            `Termo de responsabilidade - ${solicitation.protocolo} - ${equipment.name}`,
          pdfUrl: String(body.pdfUrl).trim(),
          createdById: me.id,
          assignments: {
            create: {
              userId: solicitation.solicitanteId,
              status: body.signingUrl ? 'AGUARDANDO_ASSINATURA' : 'PENDENTE',
              signingProvider: body.signingProvider ? String(body.signingProvider) : null,
              signingUrl: body.signingUrl ? String(body.signingUrl) : null,
            },
          },
        },
      })

      const updated = await tx.solicitation.update({
        where: { id: solicitation.id },
        data: {
          assumidaPorId: me.id,
          assumidaEm: new Date(),
          requiresApproval: false,
          approvalStatus: 'APROVADO',
          approverId: null,
          status: 'AGUARDANDO_TERMO',
        },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'AGUARDANDO_TERMO',
          message: `Equipamento ${equipment.patrimonio} alocado e termo enviado para assinatura.`,
        },
      })

      await tx.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'TERMO_GERADO',
        },
      })

      return { updated, document }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro no fluxo de equipamento da solicitação', error)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação de equipamento.' },
      { status: 500 },
    )
  }
}