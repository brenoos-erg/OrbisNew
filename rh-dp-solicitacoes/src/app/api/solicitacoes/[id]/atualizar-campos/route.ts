export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import {
  getNadaConstaDefaultFieldsForSetor,
  NADA_CONSTA_SETORES,
  resolveNadaConstaSetoresByDepartment,
} from '@/lib/solicitationTypes'

const normalizeConstaValue = (value: unknown): 'CONSTA' | 'NADA_CONSTA' | null => {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()

  if (normalized === 'CONSTA') return 'CONSTA'
  if (normalized === 'NADA CONSTA' || normalized === 'NADA_CONSTA') return 'NADA_CONSTA'
  return null
}


const normalizeSetorKey = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()

const normalizeSaudeStatusValue = (value: unknown): 'Ciente' | null => {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()

  if (normalized === 'CIENTE') return 'Ciente'
  return null
}

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

   const normalizedSetor = normalizeSetorKey(setor)
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

    const isAdmin = me.role === 'ADMIN'

    if (!isAdmin && !userSetores.has(normalizedSetor)) {
      return NextResponse.json(
        { error: 'Acesso negado para atualizar este setor.' },
        { status: 403 },
      )
    }

    let setorRegistro = await prisma.solicitacaoSetor.findUnique({
      where: {
        solicitacaoId_setor: {
          solicitacaoId: id,
          setor: normalizedSetor,
        },
      },
    })

    
    if (!setorRegistro) {
      const defaultCampos = getNadaConstaDefaultFieldsForSetor(setorMeta.key)
      const camposIniciais = defaultCampos.reduce<Record<string, string>>(
        (acc, field) => {
          acc[field.name] = ''
          return acc
        },
        { [setorMeta.constaField]: '' },
      )

      setorRegistro = await prisma.solicitacaoSetor.create({
        data: {
          solicitacaoId: id,
          setor: normalizedSetor,
          status: 'PENDENTE',
          campos: camposIniciais,
        },
      })
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
     const saudeOuSstStatus =
      normalizedSetor === 'SAUDE' || normalizedSetor === 'SST' ? normalizeSaudeStatusValue(statusValue) : null
    const constaFlag =
      normalizedSetor === 'SAUDE' || normalizedSetor === 'SST'
        ? saudeOuSstStatus === 'Ciente'
          ? 'NADA_CONSTA'
          : null
        : normalizeConstaValue(statusValue)

    const shouldFinalize =
      action === 'FINALIZAR' || Boolean(finalizarSetor ?? finalizar)
    const canFinalizeSetor =
      normalizedSetor === 'SAUDE' || normalizedSetor === 'SST' ? Boolean(saudeOuSstStatus) : Boolean(constaFlag)

    if (shouldFinalize && !canFinalizeSetor) {
      return NextResponse.json(
        {
          error:
            normalizedSetor === 'SAUDE' || normalizedSetor === 'SST'
              ? 'Informe o status Ciente antes de finalizar.'
              : 'Informe o status (Consta ou Nada Consta) antes de finalizar.',
        },
        { status: 400 },
      )
    }
    if (shouldFinalize) {
      const hasObservacao = Object.entries(camposAtualizados).some(([key, value]) => {
        if (!key.toLowerCase().includes('obs')) return false
        return typeof value === 'string' && value.trim().length > 0
      })
      if (!hasObservacao) {
        return NextResponse.json(
          { error: 'Adicione uma observação antes de finalizar o setor.' },
          { status: 400 },
        )
      }
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