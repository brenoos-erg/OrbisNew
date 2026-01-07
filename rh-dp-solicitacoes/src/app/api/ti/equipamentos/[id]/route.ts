import { NextResponse } from 'next/server'
import {
  ModuleLevel,
  Prisma,
  TiEquipmentCategory,
  TiEquipmentStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withModuleLevel } from '@/lib/access'

const CATEGORY_VALUES = Object.values(TiEquipmentCategory)
const STATUS_VALUES = Object.values(TiEquipmentStatus)

export const PUT = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_2,
  async (req: Request, { params }: { params: { id: string } }) => {
    const body = await req.json().catch(() => ({} as any))
    const {
      name,
      patrimonio,
      userId,
      value,
      serialNumber,
      category,
      status,
      observations,
    } = body || {}

    if (!name?.trim() || !patrimonio?.trim() || !userId?.trim()) {
      return NextResponse.json(
        { error: 'Nome, patrimônio e usuário são obrigatórios.' },
        { status: 400 },
      )
    }

    if (!CATEGORY_VALUES.includes(category)) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    if (status && !STATUS_VALUES.includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    const equipment = await prisma.tiEquipment.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipamento não encontrado.' }, { status: 404 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, costCenterId: true, fullName: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const normalizedValue =
      value === null || typeof value === 'undefined' || value === ''
        ? null
        : new Prisma.Decimal(value)

    try {
      const updated = await prisma.tiEquipment.update({
        where: { id: params.id },
        data: {
          name: name.trim(),
          patrimonio: patrimonio.trim(),
          userId: user.id,
          value: normalizedValue,
          costCenterIdSnapshot: user.costCenterId,
          serialNumber: serialNumber?.trim() || null,
          category,
          status: status || TiEquipmentStatus.IN_STOCK,
          observations: observations?.trim() || null,
        },
      })

      return NextResponse.json({
        ok: true,
        row: updated,
        warning: !user.costCenterId
          ? 'Usuário sem centro de custo. Equipamento salvo com centro de custo vazio.'
          : undefined,
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = (err.meta?.target ?? []) as string[]
        if (target.includes('TiEquipment_patrimonio_key')) {
          return NextResponse.json(
            { error: 'Patrimônio já existe.' },
            { status: 409 },
          )
        }
        if (target.includes('TiEquipment_serialNumber_key')) {
          return NextResponse.json(
            { error: 'Número de série já cadastrado.' },
            { status: 409 },
          )
        }
      }

      console.error('PUT /api/ti/equipamentos/[id] error', err)
      return NextResponse.json(
        { error: 'Erro ao atualizar equipamento.' },
        { status: 500 },
      )
    }
  },
)

export const DELETE = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_2,
  async (_req: Request, { params }: { params: { id: string } }) => {
    try {
      await prisma.tiEquipment.delete({ where: { id: params.id } })
      return NextResponse.json({ ok: true })
    } catch (err) {
      console.error('DELETE /api/ti/equipamentos/[id] error', err)
      return NextResponse.json(
        { error: 'Erro ao excluir equipamento.' },
        { status: 500 },
      )
    }
  },
)