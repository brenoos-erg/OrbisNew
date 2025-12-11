import { NextResponse } from 'next/server'
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from 'docx'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChecklistItem = {
  name?: string
  label?: string
  status?: string
  critical?: boolean
  category?: string
}

type FatigueInfo = {
  isFatigued?: boolean
  score?: number
  answer?: string
  name?: string
}

const fatiguePoints: Record<string, number> = {
  '31': 5,
  '32': 30,
  '33': 5,
  '34': 5,
  '35': 5,
  '36': 5,
  '37': 5,
  '38': 30,
  '39': 5,
  '40': 5,
}

function parseMonthParam(month: string | null) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) - 1
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return null

  const start = new Date(year, monthIndex, 1)
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
  return { start, end, year, monthIndex }
}

function parseChecklist(value: unknown): ChecklistItem[] {
  if (Array.isArray(value)) return value as ChecklistItem[]

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed as ChecklistItem[]
    } catch (error) {
      console.error('Erro ao converter checklistJson', error)
    }
  }

  return []
}

function parseFatigue(
  value: unknown,
  fallbackScore?: number,
): { isFatigued: boolean; score: number } {
  let data: FatigueInfo | FatigueInfo[] | null = null

  if (typeof value === 'string') {
    try {
      data = JSON.parse(value)
    } catch (error) {
      console.error('Erro ao converter fatigueJson', error)
    }
  } else if (value && typeof value === 'object') {
    data = value as FatigueInfo | FatigueInfo[]
  }

  let isFatigued: boolean | null = null
  let score: number | null = typeof fallbackScore === 'number' ? fallbackScore : null

  if (Array.isArray(data)) {
    const fatigueObj = data.find(
      (item) => typeof item === 'object' && item !== null && 'isFatigued' in item,
    )
    if (fatigueObj && typeof fatigueObj === 'object') {
      if ('isFatigued' in fatigueObj) {
        isFatigued = Boolean((fatigueObj as FatigueInfo).isFatigued)
      }
      if (typeof (fatigueObj as FatigueInfo).score === 'number') {
        score = (fatigueObj as FatigueInfo).score ?? score
      }
    } else {
      const answersScore = data.reduce((total, item) => {
        if (typeof item !== 'object' || !item) return total
        if (item.answer?.toUpperCase() === 'SIM') {
          return total + (fatiguePoints[item.name ?? ''] ?? 0)
        }
        return total
      }, 0)
      if (answersScore > 0) {
        score = answersScore
      }
    }
  } else if (data && typeof data === 'object') {
    if ('isFatigued' in data) {
      isFatigued = Boolean((data as FatigueInfo).isFatigued)
    }
    if (typeof (data as FatigueInfo).score === 'number') {
      score = (data as FatigueInfo).score ?? score
    }
  }

  if (isFatigued === null) {
    isFatigued = (score ?? 0) > 0
  }

  return { isFatigued, score: score ?? 0 }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function buildHeader(plate: string | null, type: string | null, sector: string | null, month: string) {
  const [year, monthStr] = month.split('-')
  const referenceLabel = `${monthStr}/${year}`

  return [
    new Paragraph({ text: 'RELATÓRIO DE CHECKLIST DIÁRIO', bold: true }),
    new Paragraph({
      text: `Veículo: ${plate ?? '—'} | Tipo: ${type ?? '—'} | Setor: ${sector ?? '—'}`,
    }),
    new Paragraph({ text: `Mês: ${referenceLabel}` }),
  ]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const monthParam = searchParams.get('month')

  if (!vehicleId || !monthParam) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios ausentes: vehicleId e month.' },
      { status: 400 },
    )
  }

  const monthInfo = parseMonthParam(monthParam)
  if (!monthInfo) {
    return NextResponse.json({ error: 'Parâmetro month inválido. Use YYYY-MM.' }, { status: 400 })
  }

  const { start, end } = monthInfo

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, type: true, sector: true },
  })

  if (!vehicle) {
    return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
  }

  const checkins = await prisma.vehicleCheckin.findMany({
    where: { vehicleId, inspectionDate: { gte: start, lte: end } },
    orderBy: { inspectionDate: 'asc' },
  })

  // ---- monta as linhas da tabela (UM row por check-in) ----
  const rows = checkins.map((checkin) => {
    const checklist = parseChecklist(checkin.checklistJson)

    const criticalItems = checklist
      .filter((item) => {
        const status = item.status?.toUpperCase()
        const isCritical =
          typeof item.critical === 'boolean'
            ? item.critical
            : item.category?.toUpperCase() === 'CRITICO'
        return isCritical && status && status !== 'OK'
      })
      .map((item) => item.label || item.name || '—')

    const nonCriticalItems = checklist
      .filter((item) => {
        const status = item.status?.toUpperCase()
        const isCritical =
          typeof item.critical === 'boolean'
            ? item.critical
            : item.category?.toUpperCase() === 'CRITICO'
        return !isCritical && status && status !== 'OK'
      })
      .map((item) => item.label || item.name || '—')

    const fatigue = parseFatigue(checkin.fatigueJson, checkin.fatigueScore)

    const dateCell = new TableCell({
      children: [new Paragraph({ text: formatDate(checkin.inspectionDate) })],
    })
    const criticalCell = new TableCell({
      children: [
        new Paragraph({
          text: criticalItems.length > 0 ? criticalItems.join(', ') : '—',
        }),
      ],
    })
    const nonCriticalCell = new TableCell({
      children: [
        new Paragraph({
          text: nonCriticalItems.length > 0 ? nonCriticalItems.join(', ') : '—',
        }),
      ],
    })
    const fatigueCell = new TableCell({
      children: [new Paragraph({ text: fatigue.isFatigued ? 'Sim' : 'Não' })],
    })
    const scoreCell = new TableCell({
      children: [new Paragraph({ text: String(fatigue.score ?? '—') })],
    })

    return new TableRow({
      children: [dateCell, criticalCell, nonCriticalCell, fatigueCell, scoreCell],
    })
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'DATA' })] }),
          new TableCell({ children: [new Paragraph({ text: 'ITENS CRÍTICOS' })] }),
          new TableCell({ children: [new Paragraph({ text: 'ITENS NÃO CRÍTICOS' })] }),
          new TableCell({ children: [new Paragraph({ text: 'FADIGA' })] }),
          new TableCell({ children: [new Paragraph({ text: 'PONTOS' })] }),
        ],
      }),
      ...rows,
    ],
  })

  const doc = new Document({
    sections: [
      {
        children: [...buildHeader(vehicle.plate, vehicle.type, vehicle.sector, monthParam), table],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="checklist-${vehicle.plate}-${monthParam}.docx"`,
    },
  })
}
