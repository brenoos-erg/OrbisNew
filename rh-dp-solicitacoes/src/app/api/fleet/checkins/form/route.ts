import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDateLabel(date?: Date | null) {
  if (!date) return '—'
  return date.toLocaleDateString('pt-BR')
}

function formatDateTimeLabel(date?: Date | null) {
  if (!date) return '—'
  return date.toLocaleString('pt-BR')
}

function monthRange(monthParam: string | null) {
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) return { start: undefined, end: undefined }

  const [year, month] = monthParam.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

function dateRange(monthParam: string | null, startParam: string | null, endParam: string | null) {
  const baseRange = monthRange(monthParam)
  let start = baseRange.start
  let end = baseRange.end

  if (startParam) {
    const parsed = new Date(startParam)
    if (!Number.isNaN(parsed.getTime())) {
      start = parsed
    }
  }

  if (endParam) {
    const parsed = new Date(endParam)
    if (!Number.isNaN(parsed.getTime())) {
      end = new Date(parsed.getTime())
      end.setHours(23, 59, 59, 999)
    }
  }

  return { start, end }
}

type ChecklistItem = { name?: string; label?: string; status?: string; category?: string }
type FatigueItem = { name?: string; label?: string; answer?: string }
type CheckinWithDriver = Prisma.VehicleCheckinGetPayload<{
  include: { driver: { select: { fullName: true; email: true } } }
}>

function safeArrayFromJson<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed as T[]
      }
    } catch (error) {
      console.error('Erro ao converter JSON para array', error)
    }
  }

  return []
}

function paragraph(text: string, options?: { bold?: boolean; size?: number; alignment?: AlignmentType }) {
  return new Paragraph({
    alignment: options?.alignment ?? AlignmentType.LEFT,
    children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 22 })],
  })
}

function cell(children: Paragraph[], widthPercent?: number, alignment: AlignmentType = AlignmentType.LEFT) {
  return new TableCell({
    children,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
    width: widthPercent
      ? { size: widthPercent * 50, type: WidthType.PERCENTAGE }
      : { size: 0, type: WidthType.AUTO },
    verticalAlign: alignment === AlignmentType.CENTER ? VerticalAlign.CENTER : VerticalAlign.TOP,
  })
}

function buildChecklistTable(items: ChecklistItem[]) {
  if (items.length === 0) return null

  const header = new TableRow({
    children: [
      cell([paragraph('Nº', { bold: true })], 8, AlignmentType.CENTER),
      cell([paragraph('Categoria', { bold: true })], 20),
      cell([paragraph('Verificação', { bold: true })], 48),
      cell([paragraph('NC', { bold: true, alignment: AlignmentType.CENTER })], 8, AlignmentType.CENTER),
      cell([paragraph('R', { bold: true, alignment: AlignmentType.CENTER })], 8, AlignmentType.CENTER),
      cell(
        [paragraph('Conforme', { bold: true, alignment: AlignmentType.CENTER })],
        8,
        AlignmentType.CENTER,
      ),
    ],
  })

    const rows = items.map((item, index) => {
    const status = (item.status || 'OK').toUpperCase()
    const hasNonConformity = status === 'COM_PROBLEMA' || status === 'NC'
    const requiresRepair = status === 'R'
    const isOk = status === 'OK' || status === 'CONFORME'
    const isNotApplicable = status === 'NAO_SE_APLICA'

    return new TableRow({
      children: [
        cell([paragraph(String(index + 1), { alignment: AlignmentType.CENTER })], 8, AlignmentType.CENTER),
        cell([paragraph(item.category || '—')], 20),
        cell([paragraph(item.label || item.name || 'Item')], 48),
         cell(
          [paragraph(hasNonConformity ? '☑' : '☐', { alignment: AlignmentType.CENTER })],
          8,
          AlignmentType.CENTER,
        ),
        cell(
          [paragraph(requiresRepair ? '☑' : '☐', { alignment: AlignmentType.CENTER })],
          8,
          AlignmentType.CENTER,
        ),
        cell([
          paragraph(
            isOk ? '☑' : isNotApplicable ? 'N/A' : '☐',
            { alignment: AlignmentType.CENTER },
          ),
        ], 8, AlignmentType.CENTER),
      ],
    })
  })

  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100 },
  })
}

function buildFatigueTable(items: FatigueItem[], score?: number | null, risk?: string | null) {
  const hasScore = score !== null && score !== undefined
  const hasRisk = Boolean(risk)

  if (items.length === 0 && !hasScore && !hasRisk) return null

  const header = new TableRow({
    children: [
      cell([paragraph('Nº', { bold: true })], 10, AlignmentType.CENTER),
      cell([paragraph('Pergunta', { bold: true })], 60),
      cell([paragraph('Resposta', { bold: true, alignment: AlignmentType.CENTER })], 30, AlignmentType.CENTER),
    ],
  })

  const rows = items.map((item, index) =>
    new TableRow({
      children: [
        cell([paragraph(String(index + 1), { alignment: AlignmentType.CENTER })], 10, AlignmentType.CENTER),
        cell([paragraph(item.label || item.name || 'Pergunta')], 60),
        cell([paragraph(item.answer || '—', { alignment: AlignmentType.CENTER })], 30, AlignmentType.CENTER),
      ],
    }),
  )

  if (hasScore || hasRisk) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              paragraph(
                `Pontuação de fadiga: ${hasScore ? score : '—'}${risk ? ` (${risk})` : ''}`,
                { bold: true },
              ),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            },
            columnSpan: 3,
          }),
        ],
      }),
    )
  }

  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 200 },
  })
}

function buildWordDocument({
  vehicle,
  checkins,
  rangeText,
}: {
  vehicle: { plate: string | null; type: string | null; sector: string | null }
  checkins: CheckinWithDriver[]
  rangeText: string
}) {
  const sections = checkins.map((checkin, index) => {
    const checklistItems = safeArrayFromJson<ChecklistItem>(checkin.checklistJson)
    const fatigueItems = safeArrayFromJson<FatigueItem>(checkin.fatigueJson)

    const nonConformity =
      checkin.hasNonConformity ||
      checkin.nonConformityActions ||
      checkin.nonConformityCriticality ||
      checkin.nonConformityManager

    const metaTable = new Table({
      rows: [
        new TableRow({
          children: [
             cell(
              [paragraph(`Placa: ${checkin.vehiclePlateSnapshot || vehicle.plate || '—'}`)],
              33,
            ),
            cell([paragraph(`Tipo: ${vehicle.type || '—'}`)], 33),
            cell([paragraph(`Setor: ${vehicle.sector || '—'}`)], 34),
          ],
        }),
        new TableRow({
          children: [
            cell([
              paragraph(`Data/Hora: ${formatDateTimeLabel(checkin.inspectionDate)}`),
            ], 33),
            cell([
              paragraph(
                `KM na inspeção: ${checkin.kmAtInspection?.toLocaleString('pt-BR') || '—'}`,
              ),
            ], 33),
            cell([paragraph(`Check-in nº: ${index + 1}`)], 34),
          ],
        }),
        new TableRow({
          children: [
            cell([
              paragraph(`Motorista: ${checkin.driverName || checkin.driver?.fullName || '—'}`),
            ], 33),
            cell([paragraph(`E-mail: ${checkin.driver?.email || '—'}`)], 33),
            cell([paragraph(`Status motorista: ${checkin.driverStatus || '—'}`)], 34),
          ],
        }),
        new TableRow({
          children: [
            cell([paragraph(`Centro de custo: ${checkin.costCenter || '—'}`)], 33),
            cell([paragraph(`Setor de atividade: ${checkin.sectorActivity || '—'}`)], 33),
            cell([paragraph(`Status veículo: ${checkin.vehicleStatus || '—'}`)], 34),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })

    const checklistTable = buildChecklistTable(checklistItems)
    const fatigueTable = buildFatigueTable(fatigueItems, checkin.fatigueScore, checkin.fatigueRisk)

    const nonConformityTable = nonConformity
      ? new Table({
          rows: [
            new TableRow({
              children: [
                cell(
                  [
                    paragraph(
                      `Criticidade: ${checkin.nonConformityCriticality || '—'}`,
                    ),
                  ],
                  50,
                ),
                cell(
                  [paragraph(`Data da tratativa: ${formatDateLabel(checkin.nonConformityDate)}`)],
                  50,
                ),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [paragraph(`Tratativas: ${checkin.nonConformityActions || '—'}`)],
                  columnSpan: 2,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                  },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [paragraph(`Responsável: ${checkin.nonConformityManager || '—'}`)],
                  columnSpan: 2,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                  },
                }),
              ],
            }),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      : null

    const children: Paragraph[] = [
      paragraph('CHECK LIST PRÉ-OPERACIONAL · VEÍCULOS LEVES', {
        bold: true,
        size: 28,
        alignment: AlignmentType.CENTER,
      }),
      paragraph(`Resumo consolidado · ${rangeText}`, {
        alignment: AlignmentType.CENTER,
        size: 20,
      }),
      new Paragraph({ children: [], spacing: { after: 200 } }),
    ]

    children.push(paragraph('Dados do veículo', { bold: true, size: 24 }))
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
    children.push(metaTable)

    if (checklistTable) {
      children.push(new Paragraph({ children: [], spacing: { before: 200, after: 100 } }))
      children.push(paragraph('Checklist', { bold: true, size: 24 }))
      children.push(checklistTable)
    }

    if (nonConformityTable) {
      children.push(new Paragraph({ children: [], spacing: { before: 200, after: 100 } }))
      children.push(paragraph('Não conformidade', { bold: true, size: 24 }))
      children.push(nonConformityTable)
    }

    if (fatigueTable) {
      children.push(new Paragraph({ children: [], spacing: { before: 200, after: 100 } }))
      children.push(paragraph('Controle de fadiga', { bold: true, size: 24 }))
      children.push(fatigueTable)
    }

    children.push(new Paragraph({ children: [], spacing: { before: 200, after: 200 } }))
    children.push(paragraph('Assinatura do motorista: ____________________________', { size: 20 }))

    return {
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }
  })

  return new Document({ sections })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')

  if (!vehicleId) {
    return NextResponse.json({ error: 'Veículo é obrigatório para gerar o formulário.' }, { status: 400 })
  }

  const monthParam = searchParams.get('month')
  const startParam = searchParams.get('startDate')
  const endParam = searchParams.get('endDate')

  const { start, end } = dateRange(monthParam, startParam, endParam)

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, type: true, sector: true },
  })

  if (!vehicle) {
    return NextResponse.json({ error: 'Veículo não encontrado.' }, { status: 404 })
  }

  const checkins = await prisma.vehicleCheckin.findMany({
    where: {
      vehicleId,
      inspectionDate: {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      },
    },
    include: {
      driver: { select: { fullName: true, email: true } },
    },
    orderBy: { inspectionDate: 'asc' },
  })

  const rangeText = start || end ? `${formatDateLabel(start)} até ${formatDateLabel(end)}` : 'Todos os registros'

  if (checkins.length === 0) {
    return NextResponse.json({ error: 'Nenhum check-in encontrado para o período selecionado.' }, { status: 404 })
  }

  const doc = buildWordDocument({ vehicle, checkins, rangeText })
  const buffer = await Packer.toBuffer(doc)
  const filename = `checkins-${vehicle.plate || 'veiculo'}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
