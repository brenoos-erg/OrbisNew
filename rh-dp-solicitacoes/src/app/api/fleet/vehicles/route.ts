import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const plate = searchParams.get('plate') ?? undefined

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(plate
        ? {
            plate: {
              equals: plate,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { costCenters: { include: { costCenter: true } } },
  })

  return NextResponse.json(vehicles)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      plate,
      type,
      model,
      costCenter,
      sector,
      kmCurrent = 0,
      status = 'DISPONIVEL',
      costCenterIds,
    } = body ?? {}

    if (!plate) {
      return NextResponse.json(
        { error: 'Placa é obrigatória' },
        { status: 400 }
      )
    }

    const normalizedPlate = String(plate).trim().toUpperCase()

    const existing = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um veículo com esta placa' },
        { status: 409 }
      )
    }

    const costCenterIdsArray = Array.isArray(costCenterIds)
      ? [...new Set(costCenterIds.filter((id: unknown) => typeof id === 'string'))]
      : []

    const result = await prisma.$transaction(async (tx) => {
      const createdVehicle = await tx.vehicle.create({
        data: {
          plate: normalizedPlate,
          type,
          model,
          costCenter,
          sector,
          kmCurrent,
          status,
        },
      })

      if (costCenterIdsArray.length > 0) {
        await tx.vehicleCostCenter.createMany({
          data: costCenterIdsArray.map((costCenterId: string) => ({
            vehicleId: createdVehicle.id,
            costCenterId,
          })),
          skipDuplicates: true,
        })
      }

      return tx.vehicle.findUnique({
        where: { id: createdVehicle.id },
        include: { costCenters: { include: { costCenter: true } } },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar veículo', error)
    return NextResponse.json(
      { error: 'Erro ao criar veículo' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { type, model, costCenter, sector, kmCurrent, status, costCenterIds } = body ?? {}

    const costCenterIdsArray = Array.isArray(costCenterIds)
      ? [...new Set(costCenterIds.filter((cc: unknown) => typeof cc === 'string'))]
      : null

    const vehicle = await prisma.$transaction(async (tx) => {
      const updatedVehicle = await tx.vehicle.update({
        where: { id },
        data: {
          ...(type ? { type } : {}),
          ...(model ? { model } : {}),
          ...(costCenter ? { costCenter } : {}),
          ...(sector ? { sector } : {}),
          ...(typeof kmCurrent === 'number' ? { kmCurrent } : {}),
          ...(status ? { status } : {}),
        },
      })

      if (costCenterIdsArray) {
        await tx.vehicleCostCenter.deleteMany({
          where: {
            vehicleId: id,
            ...(costCenterIdsArray.length > 0 ? { costCenterId: { notIn: costCenterIdsArray } } : {}),
          },
        })

        if (costCenterIdsArray.length > 0) {
          await tx.vehicleCostCenter.createMany({
            data: costCenterIdsArray.map((costCenterId: string) => ({
              vehicleId: id,
              costCenterId,
            })),
            skipDuplicates: true,
          })
        }
      }

      return tx.vehicle.findUnique({
        where: { id: updatedVehicle.id },
        include: { costCenters: { include: { costCenter: true } } },
      })
    })

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error('Erro ao atualizar veículo', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar veículo' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório' },
        { status: 400 }
      )
    }

    await prisma.vehicleCheckin.deleteMany({ where: { vehicleId: id } })
    await prisma.vehicle.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir veículo', error)
    return NextResponse.json(
      { error: 'Erro ao excluir veículo' },
      { status: 500 }
    )
  }
}