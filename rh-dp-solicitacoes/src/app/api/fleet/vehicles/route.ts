export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { normalizePlate, isValidPlate } from '@/lib/plate'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature } from '@/lib/permissions'

export const runtime = 'nodejs'


export async function GET(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/vehicles][GET] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  const canViewVehicles = await canFeature(
    appUser.id,
    MODULE_KEYS.FROTAS,
    FEATURE_KEYS.FROTAS.VEICULOS,
    Action.VIEW,
  )
  if (!canViewVehicles) {
    return NextResponse.json(
      { error: 'Acesso negado ao módulo de frotas.', requestId },
      { status: 403 },
    )
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const plate = searchParams.get('plate') ?? undefined
  const canListVehicles = await canFeature(
    appUser.id,
    MODULE_KEYS.FROTAS,
    FEATURE_KEYS.FROTAS.VEICULOS,
    Action.UPDATE,
  )

  if (!canListVehicles && !plate) {
    return NextResponse.json(
      {
        error: 'Consulte veículos individualmente ou solicite acesso de nível 2 para listar.',
        requestId,
      },
      { status: 403 },
    )
  }

  const vehicles = await prisma.vehicle.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(plate
        ? {
            plate: {
              equals: plate,
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      costCenters: { include: { costCenter: true } },
      checkins: {
        select: { inspectionDate: true },
        orderBy: { inspectionDate: 'desc' },
        take: 1,
      },
    },
  })

  const withLastCheckin = vehicles
    .map((vehicle) => {
      const { checkins, ...rest } = vehicle
      return {
        ...rest,
        lastCheckinAt: checkins?.[0]?.inspectionDate ?? null,
      }
    })
    .sort((a, b) => {
      const bLastCheck = b.lastCheckinAt?.getTime() ?? 0
      const aLastCheck = a.lastCheckinAt?.getTime() ?? 0

      if (bLastCheck !== aLastCheck) return bLastCheck - aLastCheck

      return b.createdAt.getTime() - a.createdAt.getTime()
    })

  return NextResponse.json(withLastCheckin)
}

export async function POST(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/vehicles][POST] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const canCreateVehicles = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.VEICULOS,
      Action.CREATE,
    )
    if (!canCreateVehicles) {
      return NextResponse.json(
        { error: 'Sem permissão para gerenciar veículos.', requestId },
        { status: 403 },
      )
    }

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
        { error: 'Placa é obrigatória', requestId },
        { status: 400 }
      )
    }

    const normalizedPlate = normalizePlate(String(plate))
    if (!isValidPlate(normalizedPlate)) {
      return NextResponse.json(
         {
           error: 'Placa inválida. Use o padrão ABC1A34 (Mercosul) ou ABC1234 (antiga).',
           requestId,
         },
        { status: 400 }
      )
    }


    const existing = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um veículo com esta placa', requestId },
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
  console.error('Erro ao criar veículo', { requestId, error })
    return NextResponse.json(
      { error: 'Erro ao criar veículo', requestId },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/vehicles][PATCH] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const canUpdateVehicles = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.VEICULOS,
      Action.UPDATE,
    )
    if (!canUpdateVehicles) {
      return NextResponse.json(
        { error: 'Sem permissão para gerenciar veículos.', requestId },
        { status: 403 },
      )
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório', requestId },
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
    console.error('Erro ao atualizar veículo', { requestId, error })
    return NextResponse.json(
      { error: 'Erro ao atualizar veículo', requestId },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/vehicles][DELETE] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const canDeleteVehicles = await canFeature(
      appUser.id,
      MODULE_KEYS.FROTAS,
      FEATURE_KEYS.FROTAS.VEICULOS,
      Action.DELETE,
    )
    if (!canDeleteVehicles) {
      return NextResponse.json(
        { error: 'Sem permissão para gerenciar veículos.', requestId },
        { status: 403 },
      )
    }
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID do veículo é obrigatório', requestId },
        { status: 400 }
      )
    }

    await prisma.vehicleCheckin.deleteMany({ where: { vehicleId: id } })
    await prisma.vehicle.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
     console.error('Erro ao excluir veículo', { requestId, error })
    return NextResponse.json(
      { error: 'Erro ao excluir veículo', requestId },
      { status: 500 }
    )
  }
}