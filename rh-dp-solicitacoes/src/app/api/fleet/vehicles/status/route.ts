export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth'
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
  try {
    const { appUser } = await getCurrentAppUser()
    if (!appUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { vehicleId, status, reason } = body ?? {}

    if (!vehicleId || !status || typeof reason !== 'string') {
      return NextResponse.json(
        { error: 'Dados obrigatórios ausentes: veículo, status ou motivo.' },
        { status: 400 }
      )
    }

    const normalizedStatus = String(status).toUpperCase()

    if (!allowedStatuses.includes(normalizedStatus)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
    }

    const trimmedReason = reason.trim()
    if (trimmedReason.length === 0) {
      return NextResponse.json({ error: 'Informe o motivo para alterar o status.' }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
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
    console.error('Erro ao alterar status do veículo', error)
    return NextResponse.json({ error: 'Erro ao alterar status do veículo.' }, { status: 500 })
  }
}