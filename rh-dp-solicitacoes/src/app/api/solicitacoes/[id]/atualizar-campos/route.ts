export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import {
  NADA_CONSTA_SETORES,
  resolveNadaConstaSetoresByDepartment,
} from '@/lib/solicitationTypes'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const me = await requireActiveUser()
    const { id } = await params
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Payload inválido.' },
        { status: 400 },
      )
    }

    const { campos, finalizar, finalizarSetor, setor, action } = body as {
      campos?: Record<string, string>
      finalizar?: boolean
      finalizarSetor?: boolean
      setor?: string
      action?: 'SALVAR' | 'FINALIZAR'
    }

    if (!setor) {
      return NextResponse.json(
        { error: 'Setor é obrigatório.' },
        { status: 400 },
      )
    }

    if (!campos || typeof campos !== 'object') {
      return NextResponse.json(
        { error: 'Campos são obrigatórios.' },
        { status: 400 },
      )
    }
    if (action && action !== 'SALVAR' && action !== 'FINALIZAR') {
      return NextResponse.json(
        { error: 'Ação inválida.' },
        { status: 400 },
      )
    }

    const normalizedSetor = setor.toUpperCase()
    const setorMeta = NADA_CONSTA_SETORES.find((s) => s.key === normalizedSetor)
    if (!setorMeta) {
      return NextResponse.json(
        { error: 'Setor inválido.' },
        { status: 400 },
      )
    }

    const departmentLinks = await prisma.userDepartment.findMany({
      where: { userId: me.id },
      select: {
        department: { select: { id: true, code: true, name: true } },
      },
    })

    const userSetores = new Set<string>()
    const primarySetores = resolveNadaConstaSetoresByDepartment(me.department)
    for (const setor of primarySetores) {
      userSetores.add(setor)
    }

    for (const link of departmentLinks) {
      const resolved = resolveNadaConstaSetoresByDepartment(link.department)
      for (const setor of resolved) {
        userSetores.add(setor)
      }
    }

    const isDpOrAdmin =
      me.role === 'ADMIN' ||
      me.role === 'DP' ||
      me.department?.code === '08' ||
      departmentLinks.some((link) => link.department?.code === '08')

    if (!isDpOrAdmin && !userSetores.has(normalizedSetor)) {
      return NextResponse.json(
        { error: 'Acesso negado para atualizar este setor.' },
        { status: 403 },
      )
    }

    const setorRegistro = await prisma.solicitacaoSetor.findUnique({
      where: {
        solicitacaoId_setor: {
          solicitacaoId: id,
          setor: normalizedSetor,
        },
      },
    })

    if (!setorRegistro) {
      return NextResponse.json(
        { error: 'Setor da solicitação não encontrado.' },
        { status: 404 },
      )
    }

    if (setorRegistro.status === 'CONCLUIDO') {
      return NextResponse.json(
        { error: 'Setor já concluído. Não é possível editar.' },
        { status: 409 },
      )
    }

    const camposOrigem = (setorRegistro.campos ?? {}) as Record<string, any>
    const camposAtualizados = {
      ...camposOrigem,
      ...campos,
    }

    const statusValue = camposAtualizados[setorMeta.constaField]
    const normalizedStatus =
      typeof statusValue === 'string'
        ? statusValue
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
        : ''
    const constaFlag =
      normalizedStatus === 'CONSTA'
        ? 'CONSTA'
        : normalizedStatus === 'NADA CONSTA' ||
            normalizedStatus === 'NADA_CONSTA'
          ? 'NADA_CONSTA'
          : null

    const shouldFinalize =
      action === 'FINALIZAR' || Boolean(finalizarSetor ?? finalizar)
    if (shouldFinalize && !constaFlag) {
      return NextResponse.json(
        { error: 'Informe o status (Consta ou Nada Consta) antes de finalizar.' },
        { status: 400 },
      )
    }

    const agora = new Date()

    const updated = await prisma.solicitacaoSetor.update({
       where: {
        solicitacaoId_setor: {
          solicitacaoId: id,
          setor: normalizedSetor,
        },
      },
      data: {
        campos: camposAtualizados,
        constaFlag,
        ...(shouldFinalize
          ? {
              status: 'CONCLUIDO',
              finalizadoEm: agora,
              finalizadoPor: me.id,
            }
          : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST /api/solicitacoes/[id]/atualizar-campos error', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar campos da solicitação.' },
      { status: 500 },
    )
  }
}