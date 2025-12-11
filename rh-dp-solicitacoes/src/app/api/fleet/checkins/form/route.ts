import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ------------- HELPERS DE DATA -------------

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

function dayKey(date: Date) {
  // chave YYYY-MM-DD
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ------------- TIPOS AUXILIARES -------------

type ChecklistItem = { name?: string; label?: string; status?: string; category?: string }
type FatigueItem = { name?: string; label?: string; answer?: string }

type CheckinWithDriver = Prisma.VehicleCheckinGetPayload<{
  include: { driver: { select: { fullName: true; email: true } } }
}>

// ------------- HELPERS GERAIS -------------

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

function checkbox(checked: boolean) {
  return checked ? '☑' : '☐'
}

function escapeHtml(value: unknown) {
  const safeValue = value ?? ''
  return String(safeValue)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ------------- TABELAS HTML -------------

// tabela dos itens de checklist, com colunas NC / R / NI
function renderChecklistTable(items: ChecklistItem[]) {
  if (items.length === 0) return ''

  const rows = items
    .map((item, index) => {
      const label = escapeHtml(item.label || item.name || 'Item')
      const category = escapeHtml(item.category || '—')
      const statusRaw = (item.status || 'OK').toUpperCase()

      // Regras de status:
      // - crítico: "OK" / "COM_PROBLEMA"
      // - não crítico: "OK" / "COM_PROBLEMA" / "NAO_SE_APLICA"
      // Mapeando para as colunas:
      const isNc = statusRaw === 'COM_PROBLEMA'
      const isNi = statusRaw === 'NAO_SE_APLICA'
      const isR = false // se futuramente tiver outro estado "R", ajustar aqui

      return `
        <tr>
          <td class="cell narrow">${index + 1}</td>
          <td class="cell">${category}</td>
          <td class="cell">${label}</td>
          <td class="cell center">${checkbox(isNc)}</td>
          <td class="cell center">${checkbox(isR)}</td>
          <td class="cell center">${checkbox(isNi)}</td>
        </tr>
      `
    })
    .join('')

  return `
    <table class="full">
      <thead>
        <tr>
          <th class="cell narrow">Nº</th>
          <th class="cell">Categoria</th>
          <th class="cell">Verificação</th>
          <th class="cell center">NC</th>
          <th class="cell center">R</th>
          <th class="cell center">NI</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `
}

// tabela de controle de fadiga (respostas Sim/Não)
function renderFatigueTable(items: FatigueItem[], score?: number | null, risk?: string | null) {
  const hasScore = score !== null && score !== undefined
  const hasRisk = Boolean(risk)

  if (items.length === 0 && !hasScore && !hasRisk) return ''

  const rows = items
    .map((item, index) => {
      const label = escapeHtml(item.label || item.name || 'Pergunta')
      const answer = escapeHtml(item.answer || '—') // normalmente "Sim" / "Não"

      return `
        <tr>
          <td class="cell narrow">${index + 1}</td>
          <td class="cell">${label}</td>
          <td class="cell center">${answer}</td>
        </tr>
      `
    })
    .join('')

  const summaryRow =
    hasScore || hasRisk
      ? `
        <tr>
          <td class="cell" colspan="3">
            <strong>Pontuação de fadiga:</strong>
            ${escapeHtml(`${hasScore ? score : '—'}${risk ? ` (${risk})` : ''}`)}
          </td>
        </tr>
      `
      : ''

  return `
    <table class="full">
      <thead>
        <tr>
          <th class="cell narrow">Nº</th>
          <th class="cell">Pergunta</th>
          <th class="cell center">Resposta</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${summaryRow}
      </tbody>
    </table>
  `
}

// tabela-resumo diária: mostra TODOS os dias do período
function renderDailySummary(start: Date | undefined, end: Date | undefined, checkins: CheckinWithDriver[]) {
  if (!start && !end) return ''

  if (checkins.length === 0) return ''

  const effectiveStart = new Date(start ?? checkins[0].inspectionDate)
  const effectiveEnd = new Date(end ?? checkins[checkins.length - 1].inspectionDate)
  effectiveStart.setHours(0, 0, 0, 0)
  effectiveEnd.setHours(0, 0, 0, 0)

  const counts = new Map<string, number>()
  checkins.forEach((c) => {
    const key = dayKey(c.inspectionDate)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })

  let rows = ''

  for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d)
    const count = counts.get(key) ?? 0
    const dateLabel = formatDateLabel(new Date(d))

    rows += `
      <tr>
        <td class="cell narrow center">${d.getDate()}</td>
        <td class="cell center">${escapeHtml(dateLabel)}</td>
        <td class="cell center">${count > 0 ? count : ''}</td>
      </tr>
    `
  }

  return `
    <div class="block">
      <h2>Resumo diário do período</h2>
      <table class="full daily">
        <thead>
          <tr>
            <th class="cell narrow center">Dia</th>
            <th class="cell center">Data</th>
            <th class="cell center">Qtde de check-ins</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

// ------------- MONTAGEM DO "DOC" -------------

type BuildDocParams = {
  vehicle: { plate: string | null; type: string | null; sector: string | null }
  checkins: CheckinWithDriver[]
  rangeText: string
  start?: Date
  end?: Date
}

function buildWordDocument({ vehicle, checkins, rangeText, start, end }: BuildDocParams) {
  const dailySummary = renderDailySummary(start, end, checkins)

  const sections = checkins.map((checkin, index) => {
    const checklistItems = safeArrayFromJson<ChecklistItem>(checkin.checklistJson)
    const fatigueItems = safeArrayFromJson<FatigueItem>(checkin.fatigueJson)

    const nonConformity =
      checkin.hasNonConformity ||
      checkin.nonConformityActions ||
      checkin.nonConformityCriticality ||
      checkin.nonConformityManager

    return `
      <section class="section">
        <table class="full meta">
          <tr>
            <td class="cell"><strong>Placa:</strong> ${escapeHtml(vehicle.plate || '—')}</td>
            <td class="cell"><strong>Tipo:</strong> ${escapeHtml(vehicle.type || '—')}</td>
            <td class="cell"><strong>Setor:</strong> ${escapeHtml(vehicle.sector || '—')}</td>
            <td class="cell"><strong>Período:</strong> ${escapeHtml(rangeText)}</td>
          </tr>
          <tr>
            <td class="cell"><strong>Data/Hora:</strong> ${escapeHtml(formatDateTimeLabel(checkin.inspectionDate))}</td>
            <td class="cell"><strong>KM na inspeção:</strong> ${escapeHtml(
              checkin.kmAtInspection?.toLocaleString('pt-BR') || '—',
            )}</td>
            <td class="cell"><strong>Check-in nº:</strong> ${index + 1}</td>
            <td class="cell"><strong>Status veículo:</strong> ${escapeHtml(checkin.vehicleStatus || '—')}</td>
          </tr>
          <tr>
            <td class="cell"><strong>Motorista:</strong> ${escapeHtml(
              checkin.driverName || checkin.driver?.fullName || '—',
            )}</td>
            <td class="cell"><strong>E-mail:</strong> ${escapeHtml(checkin.driver?.email || '—')}</td>
            <td class="cell"><strong>Centro de custo:</strong> ${escapeHtml(checkin.costCenter || '—')}</td>
            <td class="cell"><strong>Status motorista:</strong> ${escapeHtml(checkin.driverStatus || '—')}</td>
          </tr>
        </table>

        <div class="block">
          <h2>Checklist</h2>
          ${renderChecklistTable(checklistItems)}
        </div>

        ${
          nonConformity
            ? `
              <div class="block">
                <h2>Não conformidade</h2>
                <table class="full">
                  <tr>
                    <td class="cell"><strong>Criticidade:</strong> ${escapeHtml(
                      checkin.nonConformityCriticality || '—',
                    )}</td>
                    <td class="cell"><strong>Data da tratativa:</strong> ${escapeHtml(
                      formatDateLabel(checkin.nonConformityDate),
                    )}</td>
                  </tr>
                  <tr>
                    <td class="cell" colspan="2"><strong>Tratativas:</strong> ${escapeHtml(
                      checkin.nonConformityActions || '—',
                    )}</td>
                  </tr>
                  <tr>
                    <td class="cell" colspan="2"><strong>Responsável:</strong> ${escapeHtml(
                      checkin.nonConformityManager || '—',
                    )}</td>
                  </tr>
                </table>
              </div>
            `
            : ''
        }

        <div class="block">
          <h2>Controle de fadiga</h2>
          ${renderFatigueTable(fatigueItems, checkin.fatigueScore, checkin.fatigueRisk)}
        </div>
      </section>
    `
  })

  const combinedSections = sections.join('')

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            font-family: Arial, sans-serif;
            margin: 0;
            font-size: 9pt;
            color: #111;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .logo {
            height: 26px;
          }

          .header-text {
            flex: 1;
            text-align: center;
          }

          h1 {
            font-size: 12pt;
            margin: 0 0 2px 0;
          }

          h2 {
            font-size: 9pt;
            margin: 4px 0;
          }

          .muted {
            color: #555;
            font-size: 8pt;
          }

          table.full {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            font-size: 8pt;
          }

          table.meta {
            margin-bottom: 6px;
          }

          table.daily {
            margin-top: 2px;
          }

          .cell {
            border: 1px solid #333;
            padding: 2px 4px;
            vertical-align: middle;
          }

          .narrow {
            width: 18px;
            text-align: center;
          }

          .center {
            text-align: center;
          }

          .block {
            margin-top: 4px;
          }

          .section {
            margin-top: 8px;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/erg-logo.png" alt="ERG" class="logo" />
          <div class="header-text">
            <h1>CHECK LIST PRÉ-OPERACIONAL · VEÍCULOS LEVES E CONDUTORES</h1>
            <p class="muted">Registro consolidado de check-ins · ${escapeHtml(rangeText)}</p>
          </div>
          <div style="width: 60px;"></div>
        </div>

        ${dailySummary}

        ${combinedSections}
      </body>
    </html>
  `
}

// ------------- ROTA GET -------------

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

  const html = buildWordDocument({ vehicle, checkins, rangeText, start: start ?? undefined, end: end ?? undefined })
  const buffer = Buffer.from(html, 'utf-8')
  const filename = `checkins-${vehicle.plate || 'veiculo'}.doc`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/msword; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
