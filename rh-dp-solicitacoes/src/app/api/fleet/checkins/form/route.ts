import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

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

type LineSpec = { text: string; size?: number; gap?: number }

type PositionedLine = { text: string; size: number; y: number }

type ChecklistItem = { name?: string; label?: string; status?: string; category?: string }
type FatigueItem = { name?: string; label?: string; answer?: string }

function safeArrayFromJson<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }

  return []
}

function paginateLines(lines: LineSpec[]) {
  const pages: PositionedLine[][] = []
  let current: PositionedLine[] = []
  let y = 760

  lines.forEach((line) => {
    const gap = line.gap ?? 16
    const size = line.size ?? 12

    if (y < 60) {
      pages.push(current)
      current = []
      y = 760
    }

    current.push({ text: line.text, size, y })
    y -= gap
  })

  if (current.length === 0) {
    current.push({ text: 'Nenhum check-in encontrado para o período selecionado.', size: 12, y })
  }

  pages.push(current)
  return pages
}

function buildContentStream(lines: PositionedLine[]) {
  return lines
    .map((line) => {
      return `BT /F1 ${line.size} Tf 1 0 0 1 50 ${line.y} Tm (${escapePdfText(line.text)}) Tj ET`
    })
    .join('\n')
}

function buildPdf(pages: PositionedLine[][]) {
  const contentStreams = pages.map((page) => buildContentStream(page))
  const objects: string[] = []

  // 1: Font
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  // 2..N: Content streams
  contentStreams.forEach((content) => {
    const length = Buffer.byteLength(content, 'utf-8')
    const stream = `<< /Length ${length} >>\nstream\n${content}\nendstream`
    objects.push(stream)
  })

  const totalPages = contentStreams.length || 1
  const pagesRefIndex = 1 + contentStreams.length + totalPages + 1

  // Page objects
  for (let i = 0; i < totalPages; i += 1) {
    const contentId = 2 + i
    const page = `<< /Type /Page /Parent ${pagesRefIndex} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentId} 0 R >>`
    objects.push(page)
  }

  // Pages object
  const kids = Array.from({ length: totalPages }, (_, index) => `${2 + contentStreams.length + index} 0 R`).join(' ')
  objects.push(`<< /Type /Pages /Count ${totalPages} /Kids [${kids}] >>`)

  // Catalog object
  objects.push(`<< /Type /Catalog /Pages ${objects.length} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, 'utf-8')
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefPosition = Buffer.byteLength(pdf, 'utf-8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  objects.forEach((_, index) => {
    pdf += `${String(offsets[index + 1]).padStart(10, '0')} 00000 n \n`
  })

  const catalogIndex = objects.length
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogIndex} 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`

  return Buffer.from(pdf, 'utf-8')
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

  const lines: LineSpec[] = []

  lines.push({ text: 'CHECK LIST PRÉ-OPERACIONAL • VEÍCULO LEVE', size: 18 })
  lines.push({ text: 'Registro de check-ins', size: 14 })
  lines.push({ text: '' })
  lines.push({ text: `Placa: ${vehicle.plate || '—'}` })
  lines.push({ text: `Tipo: ${vehicle.type || '—'}` })
  lines.push({ text: `Setor: ${vehicle.sector || '—'}` })

  const rangeText = start || end ? `${formatDateLabel(start)} até ${formatDateLabel(end)}` : 'Todos os registros'
  lines.push({ text: `Período: ${rangeText}` })
  lines.push({ text: '' })

  if (checkins.length === 0) {
    lines.push({ text: 'Nenhum check-in encontrado para o período selecionado.' })
  }

  checkins.forEach((checkin, index) => {
    lines.push({ text: `Check-in ${index + 1}`, size: 14 })
    lines.push({ text: `Data/Hora: ${formatDateTimeLabel(checkin.inspectionDate)}` })
    lines.push({ text: `KM na inspeção: ${checkin.kmAtInspection?.toLocaleString('pt-BR') ?? '—'}` })
    lines.push({ text: `Motorista: ${checkin.driverName || checkin.driver?.fullName || '—'}` })
    lines.push({ text: `E-mail: ${checkin.driver?.email || '—'}` })
    lines.push({ text: `Centro de custo: ${checkin.costCenter || '—'}` })
    lines.push({ text: `Setor de atividade: ${checkin.sectorActivity || '—'}` })
    lines.push({ text: `Status motorista: ${checkin.driverStatus || '—'}` })
    lines.push({ text: `Status veículo: ${checkin.vehicleStatus || '—'}` })
    lines.push({ text: `Possui não conformidade: ${checkin.hasNonConformity ? 'Sim' : 'Não'}` })

    if (checkin.nonConformityActions || checkin.nonConformityCriticality || checkin.nonConformityManager) {
      lines.push({ text: 'Dados da não conformidade:', size: 12 })
      lines.push({ text: `- Criticidade: ${checkin.nonConformityCriticality || '—'}` })
      lines.push({ text: `- Tratativas: ${checkin.nonConformityActions || '—'}` })
      lines.push({ text: `- Responsável: ${checkin.nonConformityManager || '—'}` })
      lines.push({ text: `- Data da tratativa: ${formatDateLabel(checkin.nonConformityDate)}` })
    }

    const checklistItems = safeArrayFromJson<ChecklistItem>(checkin.checklistJson)
    if (checklistItems.length > 0) {
      lines.push({ text: 'Checklist informado:' })
      checklistItems.forEach((item) => {
        const status = item.status || 'OK'
        const label = item.label || item.name || 'Item'
        const category = item.category ? ` • Categoria: ${item.category}` : ''
        lines.push({ text: `- ${label} • Status: ${status}${category}` })
      })
    }

    const fatigueItems = safeArrayFromJson<FatigueItem>(checkin.fatigueJson)
    if (fatigueItems.length > 0) {
      lines.push({ text: 'Controle de fadiga:' })
      fatigueItems.forEach((item) => {
        const answer = item.answer || '—'
        const label = item.label || item.name || 'Pergunta'
        lines.push({ text: `- ${label}: ${answer}` })
      })
      lines.push({ text: `Pontuação de fadiga: ${checkin.fatigueScore ?? '—'} (${checkin.fatigueRisk || '—'})` })
    }

    lines.push({ text: '' })
  })

  const pages = paginateLines(lines)
  const pdfBuffer = buildPdf(pages)

  const filename = `checkins-${vehicle.plate || 'veiculo'}.pdf`

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}