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

    const vehicle = await prisma.vehicle.create({
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

    return NextResponse.json(vehicle, { status: 201 })
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
    const { type, model, costCenter, sector, kmCurrent, status } = body ?? {}

    const vehicle = await prisma.vehicle.update({
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

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error('Erro ao atualizar veículo', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar veículo' },
      { status: 500 }
    )
  }
}