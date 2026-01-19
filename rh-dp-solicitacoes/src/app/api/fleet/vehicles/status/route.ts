export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'

import { getCurrentAppUserFromRouteHandler } from '@/lib/auth-route'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const allowedStatuses = ['DISPONIVEL', 'EM_USO', 'RESERVADO', 'EM_MANUTENCAO', 'RESTRITO']

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId') ?? undefined

  if (!vehicleId) {
    return NextResponse.json({ error: 'vehicleId é obrigatório' }, { status: 400 })
  }

  const logs = await prisma.vehicleStatusLog.findMany({
    where: { vehicleId },
    include: { createdBy: { select: { fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(logs)
}

export async function POST(req: Request) {
  const { appUser, requestId, dbUnavailable } = await getCurrentAppUserFromRouteHandler()

  if (!appUser) {
    console.warn('[fleet/vehicles/status][POST] Não autenticado', { requestId })
    if (dbUnavailable) {
      return NextResponse.json(
        { error: 'Banco de dados indisponível no momento.', dbUnavailable: true, requestId },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: 'Não autenticado', requestId }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { vehicleId, status, reason } = body ?? {}

    if (!vehicleId || !status || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes: veículo, status ou motivo.', requestId },
        { status: 400 }
      )
    }

    const normalizedStatus = String(status).toUpperCase()

    if (!allowedStatuses.includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Status inválido.', requestId }, { status: 400 })
    }

    const trimmedReason = reason.trim()
    if (trimmedReason.length === 0) {
      return NextResponse.json(
        { error: 'Informe o motivo para alterar o status.', requestId },
        { status: 400 },
      )
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.', requestId }, { status: 404 })
    }

    const log = await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { status: normalizedStatus } })

      return tx.vehicleStatusLog.create({
        data: {
          vehicleId,
          status: normalizedStatus,
          reason: trimmedReason,
          createdById: appUser.id,
        },
        include: { createdBy: { select: { fullName: true, email: true } } },
      })
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    console.error('Erro ao alterar status do veículo', { requestId, error })
    return NextResponse.json(
      { error: 'Erro ao alterar status do veículo.', requestId },
      { status: 500 },
    )
  }
}