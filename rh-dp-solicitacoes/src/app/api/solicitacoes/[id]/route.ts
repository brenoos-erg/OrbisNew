// src/app/api/solicitacoes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/solicitacoes/[id]
 * Retorna os detalhes completos de uma solicitação específica.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const item = await prisma.solicitation.findUnique({
      where: { id: params.id },
      include: {
        tipo: true,
        costCenter: true,
        comentarios: {
          include: {
            autor: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        anexos: true,
        eventos: {
          orderBy: { createdAt: 'asc' },
        },
        timelines: {
          orderBy: { createdAt: 'asc' },
        },
        // 👇 filhos vinculados
        children: {
          include: {
            tipo: { select: { nome: true } },
            department: { select: { name: true } },
          },
          orderBy: { dataAbertura: 'asc' },
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // Mapeia para o formato que o front espera
    const result = {
  id: item.id,
  protocolo: item.protocolo,
  titulo: item.titulo,
  descricao: item.descricao,

  status: item.status,
  approvalStatus: item.approvalStatus,   // 👈 ADICIONAR ISSO

  dataAbertura: item.dataAbertura?.toISOString(),
  dataPrevista: item.dataPrevista?.toISOString() ?? null,
  dataFechamento: item.dataFechamento?.toISOString() ?? null,
  dataCancelamento: item.dataCancelamento?.toISOString() ?? null,
      tipo: item.tipo
        ? {
            id: item.tipo.id,
            nome: item.tipo.nome,
            descricao: item.tipo.descricao,
            schemaJson: item.tipo.schemaJson as any,
          }
        : null,
      costCenter: item.costCenter
        ? {
            description: item.costCenter.description,
          }
        : null,
      payload: item.payload as any,
      anexos: item.anexos.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      comentarios: item.comentarios.map((c) => ({
        id: c.id,
        texto: c.texto,
        createdAt: c.createdAt.toISOString(),
        autor: c.autor
          ? {
              id: c.autor.id,
              fullName: c.autor.fullName,
              email: c.autor.email,
            }
          : null,
      })),
      eventos: item.eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        createdAt: e.createdAt.toISOString(),
        actorId: e.actorId,
      })),
      timelines: item.timelines.map((t) => ({
        id: t.id,
        status: t.status,
        message: t.message,
        createdAt: t.createdAt.toISOString(),
      })),
      // 👇 filhos simplificados para o modal
      children: item.children.map((child) => ({
        id: child.id,
        protocolo: child.protocolo,
        titulo: child.titulo,
        status: child.status,
        dataAbertura: child.dataAbertura.toISOString(),
        tipo: child.tipo ? { nome: child.tipo.nome } : null,
        setorDestino: (child as any).department?.name ?? null,
      })),
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('❌ GET /api/solicitacoes/[id] error:', e)
    return NextResponse.json(
      { error: 'Erro interno ao buscar solicitação.' },
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/solicitacoes/[id]
 *
 * Neste momento vamos usar o PATCH especificamente para
 * **REPROVAR** a solicitação a partir do painel de aprovação.
 *
 * body: { comment: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const me = await requireActiveUser() // usuário logado
    const solicitationId = params.id

    const body = await req.json().catch(() => ({}))
    const comment: string | undefined = body.comment

    if (!comment || !comment.trim()) {
      return NextResponse.json(
        { error: 'Motivo é obrigatório.' },
        { status: 400 },
      )
    }

    // 1) Buscar solicitação
    const solicitation = await prisma.solicitation.findUnique({
      where: { id: solicitationId },
    })

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitação não encontrada.' },
        { status: 404 },
      )
    }

    // Só aprova/reprova se estiver pendente de aprovação
    if (
      !solicitation.requiresApproval ||
      solicitation.approvalStatus !== 'PENDENTE'
    ) {
      return NextResponse.json(
        { error: 'Solicitação não está pendente de aprovação.' },
        { status: 400 },
      )
    }

    // Se tiver aprovador definido, só ele pode reprovar
    if (solicitation.approverId && solicitation.approverId !== me.id) {
      return NextResponse.json(
        { error: 'Você não é o aprovador desta solicitação.' },
        { status: 403 },
      )
    }

    // 2) Atualizar como REPROVADO / CANCELADA
    const updated = await prisma.solicitation.update({
      where: { id: solicitationId },
      data: {
        approvalStatus: 'REPROVADO',
        approvalAt: new Date(),
        approvalComment: comment,
        requiresApproval: false,
        status: 'CANCELADA',
      },
    })

    // 3) Timeline
    await prisma.solicitationTimeline.create({
      data: {
        solicitationId,
        status: 'REPROVADO',
        message: `Reprovado por ${me.fullName ?? me.id}: ${comment}`,
      },
    })

    // 4) Evento
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId,
        actorId: me.id,
        tipo: 'REPROVACAO',
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error('❌ PATCH /api/solicitacoes/[id] (reprovar) error:', e)
    return NextResponse.json(
      { error: 'Erro ao reprovar a solicitação.' },
      { status: 500 },
    )
  }
}