export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Action } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { isValidPlate, normalizePlate } from '@/lib/plate'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'
import { isDbUnavailableError } from '@/lib/db-unavailable'
import { jsonApiError } from '@/lib/api-error'

export const runtime = 'nodejs'

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: Request) {
  const { appUser, requestId } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/displacement-checkins][GET] Não autenticado', { requestId })
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const canViewDisplacementPanel = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL,
      Action.VIEW,
    )
    if (!canViewDisplacementPanel) {
      return NextResponse.json(
        { error: 'O painel de deslocamentos requer permissão de visualização.', requestId },
        { status: 403 },
      )
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
  } catch (error) {
    const dbUnavailable = isDbUnavailableError(error)
    console.error('Erro ao buscar deslocamentos', { requestId, error })
    return jsonApiError({
      status: dbUnavailable ? 503 : 500,
      message: dbUnavailable
        ? 'Banco de dados indisponível. Tente novamente em instantes.'
        : 'Erro ao buscar deslocamentos.',
      dbUnavailable,
      requestId,
    })
  }
}

export async function POST(req: Request) {
  const { appUser, requestId } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/displacement-checkins][POST] Não autenticado', { requestId })
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const canCreateDisplacement = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN,
      Action.CREATE,
    )
    if (!canCreateDisplacement) {
      return NextResponse.json(
        { error: 'Sem permissão para registrar deslocamento.', requestId },
        { status: 403 },
      )
    }

    const body = await req.json()
    const { tripDate, vehiclePlate, costCenterId, origin, destination, vehicleKm } = body ?? {}

    const tripDateValue = parseDate(tripDate)
    if (!tripDateValue) {
      return NextResponse.json(
        { error: 'Data do deslocamento inválida.', requestId },
        { status: 400 },
      )
    }

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Origem e destino são obrigatórios.', requestId },
        { status: 400 },
      )
    }

    if (!vehiclePlate || typeof vehiclePlate !== 'string') {
      return NextResponse.json(
        { error: 'Informe a placa do veículo.', requestId },
        { status: 400 },
      )
    }
    const vehicleKmValue =
      vehicleKm === null || vehicleKm === undefined ? null : Number.parseInt(vehicleKm, 10)

    if (vehicleKmValue !== null && (!Number.isFinite(vehicleKmValue) || vehicleKmValue < 0)) {
      return NextResponse.json(
        {
          error: 'Informe uma quilometragem válida para o veículo ou deixe em branco.',
          requestId,
        },
        { status: 400 },
      )
    }


    const normalizedPlate = normalizePlate(vehiclePlate)
    if (!isValidPlate(normalizedPlate)) {
      return NextResponse.json(
        { error: 'Placa inválida. Use o padrão ABC1A34 (Mercosul) ou ABC1234 (antiga).', requestId },
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
      return NextResponse.json({ error: 'Veículo não cadastrado.', requestId }, { status: 400 })
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
            requestId,
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
        { error: 'Selecione um centro de custo vinculado ao veículo.', requestId },
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
    const dbUnavailable = isDbUnavailableError(error)
    console.error('Erro ao registrar deslocamento', { requestId, error })
    return jsonApiError({
      status: dbUnavailable ? 503 : 500,
      message: dbUnavailable
        ? 'Banco de dados indisponível. Tente novamente em instantes.'
        : 'Erro ao registrar deslocamento. Tente novamente.',
      dbUnavailable,
      requestId,
    })
  }
}