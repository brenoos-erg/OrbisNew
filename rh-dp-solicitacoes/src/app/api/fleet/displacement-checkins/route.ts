import { Action } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'
import { isValidPlate, normalizePlate } from '@/lib/plate'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: Request) {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const canViewDisplacementPanel = await canFeature(
    appUser.id,
    MODULE_KEYS.FROTAS,
    FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL,
    Action.VIEW,
  )
  if (!canViewDisplacementPanel) {
    return NextResponse.json({ error: 'O painel de deslocamentos requer permissão de visualização.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId') ?? undefined

  const checkins = await prisma.vehicleDisplacementCheckin.findMany({
    where: { ...(vehicleId ? { vehicleId } : {}) },
    include: {
      vehicle: { select: { plate: true, type: true, model: true } },
      driver: { select: { fullName: true } },
      costCenter: { select: { description: true, externalCode: true } },
    },
    orderBy: { tripDate: 'desc' },
  })

  return NextResponse.json(checkins)
}

export async function POST(req: Request) {
  try {
    const { appUser } = await getCurrentAppUser()

    if (!appUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

     const canCreateDisplacement = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN,
      Action.CREATE,
    )
    if (!canCreateDisplacement) {
      return NextResponse.json({ error: 'Sem permissão para registrar deslocamento.' }, { status: 403 })
    }

    const body = await req.json()
    const { tripDate, vehiclePlate, costCenterId, origin, destination, vehicleKm } = body ?? {}

    const tripDateValue = parseDate(tripDate)
    if (!tripDateValue) {
      return NextResponse.json({ error: 'Data do deslocamento inválida.' }, { status: 400 })
    }

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origem e destino são obrigatórios.' }, { status: 400 })
    }

    if (!vehiclePlate || typeof vehiclePlate !== 'string') {
      return NextResponse.json({ error: 'Informe a placa do veículo.' }, { status: 400 })
    }
    const vehicleKmValue =
      vehicleKm === null || vehicleKm === undefined ? null : Number.parseInt(vehicleKm, 10)

    if (vehicleKmValue !== null && (!Number.isFinite(vehicleKmValue) || vehicleKmValue < 0)) {
      return NextResponse.json(
        { error: 'Informe uma quilometragem válida para o veículo ou deixe em branco.' },
        { status: 400 },
      )
    }


    const normalizedPlate = normalizePlate(vehiclePlate)
    if (!isValidPlate(normalizedPlate)) {
      return NextResponse.json(
        { error: 'Placa inválida. Use o padrão ABC1A34 (Mercosul) ou ABC1234 (antiga).' },
        { status: 400 },
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
      include: {
        costCenters: { select: { costCenterId: true } },
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não cadastrado.' }, { status: 400 })
    }
    if (vehicleKmValue !== null && typeof vehicle.kmCurrent === 'number' && vehicle.kmCurrent > 0) {
      if (vehicleKmValue < vehicle.kmCurrent) {
        return NextResponse.json(
          {
            error: `A quilometragem informada (${vehicleKmValue.toLocaleString(
              'pt-BR',
            )}) é menor que a última registrada para o veículo (${vehicle.kmCurrent.toLocaleString(
              'pt-BR',
            )}).`,
          },
          { status: 400 },
        )
      }
    }

    const allowedCostCenters = vehicle.costCenters.map((link) => link.costCenterId)
    const costCenterIdToSave =
      costCenterId && allowedCostCenters.includes(costCenterId) ? costCenterId : null

    if (costCenterId && !costCenterIdToSave) {
      return NextResponse.json(
        { error: 'Selecione um centro de custo vinculado ao veículo.' },
        { status: 400 },
      )
    }

    const created = await prisma.vehicleDisplacementCheckin.create({
      data: {
        vehicleId: vehicle.id,
        driverId: appUser.id,
        tripDate: tripDateValue,
        costCenterId: costCenterIdToSave ?? undefined,
        origin: String(origin),
        destination: String(destination),
        vehiclePlateSnapshot: normalizedPlate,
        vehicleTypeSnapshot: vehicle.type,
        vehicleModelSnapshot: vehicle.model,
        vehicleKmSnapshot: vehicleKmValue ?? vehicle.kmCurrent ?? null,
      },
      include: {
        vehicle: { select: { plate: true, type: true, model: true } },
        driver: { select: { fullName: true } },
        costCenter: { select: { description: true, externalCode: true } },
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Erro ao registrar deslocamento', error)
    return NextResponse.json(
      { error: 'Erro ao registrar deslocamento. Tente novamente.' },
      { status: 500 },
    )
  }
}