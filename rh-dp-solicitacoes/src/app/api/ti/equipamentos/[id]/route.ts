export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { TI_EQUIPMENT_CATEGORIES, TI_EQUIPMENT_STATUSES } from '@/lib/tiEquipment'

export const runtime = 'nodejs'

function mapRow(row: any) {
  return {
    ...row,
    value: row.value ? Number(row.value) : null,
    costCenterSnapshot: row.costCenterSnapshot
      ? {
          id: row.costCenterSnapshot.id,
          description: row.costCenterSnapshot.description,
          externalCode: row.costCenterSnapshot.externalCode,
          code: row.costCenterSnapshot.code,
        }
      : null,
  }
}

export async function PUT(req: Request, context: { params: { id: string } }) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const id = context.params.id

  try {
    const body = await req.json()
    const {
      name,
      patrimonio,
      userId,
      value,
      serialNumber,
      category,
      status,
      observations,
    } = body ?? {}

    const existing = await prisma.tiEquipment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        costCenterSnapshot: { select: { id: true, description: true, externalCode: true, code: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Equipamento não encontrado.' }, { status: 404 })
    }

    const targetCategory = category ?? existing.category

    if (!TI_EQUIPMENT_CATEGORIES.some((cat) => cat.value === targetCategory)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    if (status && !TI_EQUIPMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    const canUpdate = await canFeature(
      appUser.id,
      MODULE_KEYS.EQUIPAMENTOS_TI,
      TI_EQUIPMENT_CATEGORIES.find((cat) => cat.value === targetCategory)!.featureKey,
      Action.UPDATE,
    )

    if (!canUpdate) {
      return NextResponse.json({ error: 'Sem permissão para editar equipamentos.' }, { status: 403 })
    }

    if (!name || !patrimonio || !userId) {
      return NextResponse.json(
        { error: 'Nome, patrimônio e usuário são obrigatórios.' },
        { status: 400 },
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        fullName: true,
        email: true,
        costCenterId: true,
        costCenter: { select: { id: true, description: true, externalCode: true, code: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const updated = await prisma.tiEquipment.update({
      where: { id },
      data: {
        name: String(name).trim(),
        patrimonio: String(patrimonio).trim(),
        userId: user.id,
        value: value === null || value === undefined || value === '' ? null : new Prisma.Decimal(value),
        serialNumber: serialNumber ? String(serialNumber).trim() : null,
        category: targetCategory,
        status: status ?? existing.status,
        observations: observations ? String(observations).trim() : null,
        costCenterIdSnapshot: user.costCenterId ?? null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        costCenterSnapshot: { select: { id: true, description: true, externalCode: true, code: true } },
      },
    })

    const warning = user.costCenterId
      ? null
      : 'Usuário sem centro de custo; o registro foi salvo sem centro de custo.'

    return NextResponse.json({ item: mapRow(updated), warning })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um equipamento com o mesmo patrimônio ou série.' },
        { status: 409 },
      )
    }

    console.error('Erro ao atualizar equipamento', error)
    return NextResponse.json({ error: 'Erro ao atualizar equipamento.' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, context: { params: { id: string } }) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const id = context.params.id

  try {
    const existing = await prisma.tiEquipment.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Equipamento não encontrado.' }, { status: 404 })
    }

    const canDelete = await canFeature(
      appUser.id,
      MODULE_KEYS.EQUIPAMENTOS_TI,
      TI_EQUIPMENT_CATEGORIES.find((cat) => cat.value === existing.category)!.featureKey,
      Action.DELETE,
    )

    if (!canDelete) {
      return NextResponse.json({ error: 'Sem permissão para excluir equipamentos.' }, { status: 403 })
    }

    await prisma.tiEquipment.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir equipamento', error)
    return NextResponse.json({ error: 'Erro ao excluir equipamento.' }, { status: 500 })
  }
}