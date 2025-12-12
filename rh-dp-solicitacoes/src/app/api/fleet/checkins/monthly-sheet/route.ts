import { NextResponse } from 'next/server'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import path from 'path'
import { promises as fs } from 'fs'

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
  label?: string
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

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null
  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  if (Number.isNaN(date.getTime())) return null
  return date
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
): { isFatigued: boolean; score: number; yesAnswers: string[] } {
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
  const yesAnswers: string[] = []

  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (typeof item !== 'object' || !item) return
      if (item.answer?.toUpperCase() === 'SIM') {
        yesAnswers.push(item.label || item.name || '—')
      }
    })

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

  return { isFatigued, score: score ?? 0, yesAnswers }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatKm(km?: number | null) {
  if (typeof km !== 'number') return '—'
  return `${km.toLocaleString('pt-BR')} km`
}

// ✅ tudo preto agora (sem primary azul)
const COLORS = {
  labelBackground: 'D9D9D9',
  valueBackground: 'F3F4F6',
  rowBackground: 'F2F6FC',
}

// helpers para forçar Arial 8 e preto em todo lugar
function t(text: string, opts?: { bold?: boolean; underline?: boolean }) {
  return new TextRun({
    text,
    bold: opts?.bold,
    underline: opts?.underline ? {} : undefined,
    font: 'Arial',
    size: 16, // 8pt
    color: '000000',
  })
}

function pText(text: string, opts?: { bold?: boolean; alignment?: AlignmentType }) {
  return new Paragraph({
    children: [t(text, { bold: opts?.bold })],
    alignment: opts?.alignment,
  })
}

function buildLabelCell(text: string) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [t(text, { bold: true })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
  })
}

function buildValueCell(text: string) {
  return new TableCell({
    children: [new Paragraph({ children: [t(text)] })],
    shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.valueBackground },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
  })
}

async function buildHeader(title: string) {
  const logoPath = path.join(process.cwd(), 'public', 'erg-logotipo.png')
  let logoParagraph: Paragraph | undefined

  try {
    const logoBuffer = await fs.readFile(logoPath)
    logoParagraph = new Paragraph({
      children: [
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 125, height: 40 }
        }),
      ],
      alignment: AlignmentType.LEFT, // ✅ canto superior esquerdo
      spacing: { after: 80 },
    })
  } catch (error) {
    console.warn('Logo não encontrada em', logoPath, error)
  }

  return [
    ...(logoParagraph ? [logoParagraph] : []),
    new Paragraph({
      children: [t(title, { bold: true })], // ✅ Arial 8 preto
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ]
}

// ✅ Mantido do jeito que estava (4 colunas / 4 linhas)
function buildVehicleInfoSection(
  vehicle: {
    plate: string | null
    type: string | null
    model: string | null
    sector: string | null
    status: string | null
    costCenter: string | null
    kmCurrent: number | null
    costCenters?: Array<{ costCenter: { description: string | null; code: string | null } | null }>
  },
  periodLabel: string,
) {
  const costCenterOptions = vehicle.costCenters
    ?.map((item) => item.costCenter?.description || item.costCenter?.code)
    .filter(Boolean)

  const costCenterLabel = costCenterOptions?.join(' • ') || vehicle.costCenter || '—'

  return [
    new Paragraph({
      children: [t('Dados do veículo', { bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 80 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            buildLabelCell('Período do relatório'),
            buildValueCell(periodLabel),
            buildLabelCell('Situação do veículo'),
            buildValueCell(vehicle.status ?? '—'),
          ],
        }),
        new TableRow({
          children: [
            buildLabelCell('Placa'),
            buildValueCell(vehicle.plate ?? '—'),
            buildLabelCell('Tipo'),
            buildValueCell(vehicle.type ?? '—'),
          ],
        }),
        new TableRow({
          children: [
            buildLabelCell('Modelo'),
            buildValueCell(vehicle.model ?? '—'),
            buildLabelCell('Setor'),
            buildValueCell(vehicle.sector ?? '—'),
          ],
        }),
        new TableRow({
          children: [
            buildLabelCell('Centro de custo'),
            buildValueCell(costCenterLabel),
            buildLabelCell('KM atual'),
            buildValueCell(formatKm(vehicle.kmCurrent)),
          ],
        }),
      ],
    }),
  ]
}

type DriverSummary = {
  name: string
  email?: string | null
  phone?: string | null
  status?: string | null
}

function extractDriverNames(primary?: string | null, fallback?: string | null) {
  const merged = primary || fallback || ''
  return merged
    .split(/[;,/]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

function summarizeDrivers(
  checkins: Array<{
    driverName: string
    driver?: { fullName: string | null; email: string | null; phone: string | null } | null
    driverStatus?: string | null
  }>,
): DriverSummary[] {
  const summaries = new Map<string, DriverSummary>()

  checkins.forEach((checkin) => {
    const names = extractDriverNames(checkin.driverName, checkin.driver?.fullName)

    names.forEach((name) => {
      const key = name.toLowerCase()
      if (!summaries.has(key)) {
        summaries.set(key, {
          name,
          email: checkin.driver?.email,
          phone: checkin.driver?.phone,
          status: checkin.driverStatus,
        })
      }
    })
  })

  return Array.from(summaries.values())
}

// ✅ Igual ao print: CONDUTOR / CONTATO
function buildDriversSection(drivers: DriverSummary[]) {
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [t('CONDUTOR', { bold: true })] })],
        shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
      }),
      new TableCell({
        children: [new Paragraph({ children: [t('CONTATO', { bold: true })] })],
        shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
        margins: { top: 120, bottom: 120, left: 120, right: 120 },
      }),
    ],
  })

  const rows = (drivers.length > 0
    ? drivers
    : [{ name: 'Nenhum condutor informado', email: null, phone: null, status: null }]
  ).map((driver, index) => {
    const contacts = [driver.email, driver.phone].filter(Boolean).join(' • ')
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [t(driver.name || '—')] })],
          shading:
            index % 2 === 0
              ? { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.valueBackground }
              : undefined,
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [t(contacts || '—')] })],
          shading:
            index % 2 === 0
              ? { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.valueBackground }
              : undefined,
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
        }),
      ],
    })
  })

  return [
    new Paragraph({
      children: [t('Condutor(es)', { bold: true })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
    }),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] }),
  ]
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const monthParam = searchParams.get('month')
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  if (!vehicleId) {
    return NextResponse.json({ error: 'Parâmetro obrigatório ausente: vehicleId.' }, { status: 400 })
  }

  const monthInfo = parseMonthParam(monthParam)
  if (monthParam && !monthInfo) {
    return NextResponse.json({ error: 'Parâmetro month inválido. Use YYYY-MM.' }, { status: 400 })
  }

  const start = parseDateParam(startDateParam) || monthInfo?.start
  const end = parseDateParam(endDateParam, true) || monthInfo?.end

  if (!start || !end) {
    return NextResponse.json(
      {
        error:
          'Informe o mês (YYYY-MM) ou um intervalo válido com startDate e endDate (YYYY-MM-DD).',
      },
      { status: 400 },
    )
  }

  const periodLabel = `${formatDate(start)} a ${formatDate(end)}`

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      plate: true,
      type: true,
      model: true,
      sector: true,
      status: true,
      costCenter: true,
      kmCurrent: true,
      costCenters: { include: { costCenter: { select: { description: true, code: true } } } },
    },
  })

  if (!vehicle) {
    return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
  }

  const checkins = await prisma.vehicleCheckin.findMany({
    where: { vehicleId, inspectionDate: { gte: start, lte: end } },
    include: { driver: { select: { fullName: true, email: true, phone: true } } },
    orderBy: { inspectionDate: 'asc' },
  })

  const driverSummaries = summarizeDrivers(checkins)

  const rows = checkins.map((checkin, index) => {
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

    const baseCellConfig = {
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
    }

    const dateCell = new TableCell({
      ...baseCellConfig,
      children: [new Paragraph({ children: [t(formatDate(checkin.inspectionDate))] })],
    })

    const driverNames = extractDriverNames(checkin.driverName, checkin.driver?.fullName)

    const criticalCell = new TableCell({
      ...baseCellConfig,
      children: [
        new Paragraph({
          children: [t(criticalItems.length > 0 ? criticalItems.join(', ') : '—')],
        }),
      ],
    })

    const nonCriticalCell = new TableCell({
      ...baseCellConfig,
      children: [
        new Paragraph({
          children: [t(nonCriticalItems.length > 0 ? nonCriticalItems.join(', ') : '—')],
        }),
      ],
    })

    const fatigueText = fatigue.isFatigued
      ? fatigue.yesAnswers.length > 0
        ? `Sim (${fatigue.yesAnswers.join(', ')})`
        : 'Sim'
      : 'Não'

    const fatigueCell = new TableCell({
      ...baseCellConfig,
      children: [new Paragraph({ children: [t(fatigueText)] })],
    })

    const driverCell = new TableCell({
      ...baseCellConfig,
      children: [
        new Paragraph({ children: [t(driverNames.length > 0 ? driverNames.join(' • ') : '—')] }),
      ],
    })

    const aptitudeCell = new TableCell({
      ...baseCellConfig,
      children: [
        new Paragraph({
          children: [t(checkin.driverStatus?.toUpperCase() || '—', { bold: true })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    })

    const scoreCell = new TableCell({
      ...baseCellConfig,
      children: [new Paragraph({ children: [t(String(fatigue.score ?? '—'))] })],
    })

    return new TableRow({
      children: [
        dateCell,
        criticalCell,
        nonCriticalCell,
        fatigueCell,
        driverCell,
        aptitudeCell,
        scoreCell,
      ],
      shading:
        index % 2 === 0
          ? { type: ShadingType.CLEAR, color: 'auto', fill: COLORS.rowBackground }
          : undefined,
    })
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [t('DATA', { bold: true })] })],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [t('CHECKLIST ITENS CRÍTICOS (CONFORMIDADES)', { bold: true })],
              }),
            ],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [t('CHECKLIST ITENS NÃO CRÍTICOS (CONFORMIDADES)', { bold: true })],
              }),
            ],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [t('FADIGA', { bold: true })] })],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [t('CONDUTOR(ES)', { bold: true })] })],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [t('APTIDÃO', { bold: true })] })],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [t('PONTOS', { bold: true })] })],
            shading: { type: ShadingType.CLEAR, color: 'FFFFFF', fill: COLORS.labelBackground },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
        ],
      }),
      ...rows,
    ],
  })

  const headerSection = await buildHeader('RELATÓRIO DE CHECKLIST MENSAL')
  const vehicleInfoSection = buildVehicleInfoSection(vehicle, periodLabel)
  const driversSection = buildDriversSection(driverSummaries)

  const checklistTitle = new Paragraph({
    children: [t('Checklist e não conformidades', { bold: true })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 16, // 8pt
            color: '000000',
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children: [
          ...headerSection,
          ...vehicleInfoSection,
          ...driversSection,
          checklistTitle,
          table,
        ],
      },
    ],
  })

  const fileLabel = startDateParam || monthParam || start.toISOString().slice(0, 10)
  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="checklist-mensal-${vehicle.plate}-${fileLabel}.docx"`,
    },
  })
}
