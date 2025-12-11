import { NextResponse } from 'next/server'
import {
  AlignmentType,
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChecklistItem = { name?: string; label?: string; status?: string }

const checklistItems = [
  { code: '01', key: '01', label: 'Freios' },
  { code: '02', key: '02', label: 'Buzina / sinal sonoro de ré / sinal luminoso de ré' },
  { code: '05', key: '05', label: 'Limpadores e sistema de injeção de água no para-brisa' },
  { code: '06', key: '06', label: 'Calibragem de pneus' },
  { code: '07', key: '07', label: 'Farol alto/baxo direito e esquerdo' },
  { code: '08', key: '08', label: 'Faroletes / pisca alerta / setas' },
  { code: '09', key: '09', label: 'Macaco / triângulo de segurança / chave de roda' },
  { code: '10', key: '10', label: 'Calço de segurança' },
  { code: '11', key: '11', label: 'Retrovisores externos e interno' },
  { code: '13', key: '13', label: 'Cinto de segurança' },
  { code: '15', key: '15', label: 'Ar-condicionado em perfeito funcionamento' },
  { code: '16', key: '16', label: 'Condições gerais de limpeza (interna e externa)' },
  { code: '18', key: '18', label: 'Nível de óleo do motor, água do radiador e fluído de freio' },
  { code: '19', key: '19', label: 'Sistema de telemetria / sensor de fadiga' },
  { code: '20', key: '20', label: 'Documentos do veículo (Renavan, DUT, IPVA, Licenciamento, Seguro obrigatório, CNH, etc)' },
]

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

function safeArrayFromJson<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed as T[]
    } catch (error) {
      console.error('Erro ao converter JSON para array', error)
    }
  }

  return []
}

function statusSymbol(status?: string | null) {
  const normalized = status?.toUpperCase()
  if (normalized === 'OK') return '✓'
  if (normalized === 'COM_PROBLEMA') return 'X'
  if (normalized === 'NAO_SE_APLICA') return '•'
  return ''
}

function paragraph(text: string, align?: AlignmentType, bold = false) {
  return new Paragraph({
    alignment: align,
    children: [new TextRun({ text, bold })],
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const monthParam = searchParams.get('month')

  if (!vehicleId || !monthParam) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios ausentes: vehicleId e month.' },
      { status: 400 }
    )
  }

  const monthInfo = parseMonthParam(monthParam)
  if (!monthInfo) {
    return NextResponse.json({ error: 'Parâmetro month inválido. Use YYYY-MM.' }, { status: 400 })
  }

  const { start, end, monthIndex, year } = monthInfo
  const daysInMonth = end.getDate()

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

  const matrix: Record<number, Record<string, string>> = {}

  checkins.forEach((checkin) => {
    const day = new Date(checkin.inspectionDate).getDate()
    const checklist = safeArrayFromJson<ChecklistItem>(checkin.checklistJson)

    if (!matrix[day]) matrix[day] = {}

    checklist.forEach((item) => {
      const key = item.name || item.label
      if (!key) return
      matrix[day][key] = item.status || 'OK'
    })
  })

  const headerRows = new TableRow({
    children: [
      new TableCell({
        children: [paragraph('Item', AlignmentType.CENTER, true)],
      }),
      new TableCell({
        children: [paragraph('Verificação', AlignmentType.CENTER, true)],
      }),
      ...Array.from({ length: daysInMonth }, (_, index) =>
        new TableCell({
          children: [paragraph(String(index + 1), AlignmentType.CENTER, true)],
        })
      ),
    ],
  })

  const itemRows = checklistItems.map((item) => {
    const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const status = matrix[day]?.[item.key]
      const symbol = statusSymbol(status)

      return new TableCell({ children: [paragraph(symbol, AlignmentType.CENTER)] })
    })

    return new TableRow({
      children: [
        new TableCell({ children: [paragraph(item.code, AlignmentType.CENTER)] }),
        new TableCell({ children: [paragraph(item.label)] }),
        ...dayCells,
      ],
    })
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRows, ...itemRows],
  })

  const referenceLabel = `${String(monthIndex + 1).padStart(2, '0')}/${year}`

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
          },
        },
        children: [
          paragraph('CHECK LIST PRÉ-OPERACIONAL – VEÍCULO LEVE', AlignmentType.CENTER, true),
          paragraph(`Placa: ${vehicle.plate}   Tipo: ${vehicle.type ?? '—'}   Setor: ${vehicle.sector ?? '—'}`),
          paragraph(`Mês de referência: ${referenceLabel}`),
          table,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)

  const filename = `checklist-${vehicle.plate}-${monthParam}.docx`
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}