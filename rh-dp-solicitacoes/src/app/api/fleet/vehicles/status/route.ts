import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentAppUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedStatuses = [
  'DISPONIVEL',
  'RESTRITO',
  'EM_USO',
  'EM_MANUTENCAO',
  'RESERVADO',
]

function normalizeStatus(value?: string | null) {
  if (!value) return null
  const normalized = value.toUpperCase()
  return allowedStatuses.includes(normalized) ? normalized : null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')

  if (!vehicleId) {
    return NextResponse.json({ error: 'ID do veículo é obrigatório' }, { status: 400 })
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

    const normalizedStatus = normalizeStatus(status)
    const trimmedReason = typeof reason === 'string' ? reason.trim() : ''

    if (!vehicleId || !normalizedStatus || trimmedReason === '') {
      return NextResponse.json(
        { error: 'Veículo, status e motivo são obrigatórios.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })

    if (!vehicle) {
      return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
    }

    const log = await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { status: normalizedStatus },
      })

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
    console.error('Erro ao atualizar status do veículo', error)
    return NextResponse.json({ error: 'Erro ao atualizar status do veículo' }, { status: 500 })
  }
}