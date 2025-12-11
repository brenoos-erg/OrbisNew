import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDate(date?: Date | null) {
  if (!date) return ''
  return date.toLocaleString('pt-BR')
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId') ?? undefined

  const checkins = await prisma.vehicleCheckin.findMany({
    where: {
      ...(vehicleId ? { vehicleId } : {}),
    },
    include: {
      vehicle: { select: { plate: true, type: true, status: true } },
      driver: { select: { fullName: true, email: true } },
    },
    orderBy: { inspectionDate: 'desc' },
  })

  const header = [
    'Data/Hora',
    'Placa',
    'Tipo',
    'Motorista',
    'E-mail',
    'Centro de custo',
    'Setor',
    'KM na inspeção',
    'Status veículo',
    'Status motorista',
    'Não conformidade',
  ]

  const rows = checkins.map((checkin) => [
    formatDate(checkin.inspectionDate),
    checkin.vehicle?.plate ?? '',
    checkin.vehicle?.type ?? '',
    checkin.driver?.fullName ?? '',
    checkin.driver?.email ?? '',
    checkin.costCenter ?? '',
    checkin.sectorActivity ?? '',
    checkin.kmAtInspection,
    (checkin as { vehicleStatus?: string }).vehicleStatus ?? checkin.vehicle?.status ?? '',
    checkin.driverStatus,
    checkin.hasNonConformity ? 'Sim' : 'Não',
  ])

  const csvContent = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')

  const filename = vehicleId ? `checkins-${vehicleId}.csv` : 'checkins-geral.csv'

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}