import { NextResponse } from 'next/server'
import JSZip from 'jszip'

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

type DriverSummary = {
  name: string
  email?: string | null
  phone?: string | null
  status?: string | null
}
const KM_LIMIT_PER_DAY = 2000

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
function columnLetter(column: number) {
  let temp = column
  let letter = ''
  while (temp > 0) {
    const mod = (temp - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    temp = Math.floor((temp - mod) / 26)
  }
  return letter
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type SheetCell = {
  row: number
  col: number
  value: string | number
  style: number
  type?: 'inlineStr' | 'n'
}

type WorksheetOptions = {
  dataValidationStart?: number
  dataValidationEnd?: number
  merges?: string[]
}

function buildCellXml(cell: SheetCell) {
  const ref = `${columnLetter(cell.col)}${cell.row}`
  const styleAttr = ` s="${cell.style}"`

  if (typeof cell.value === 'number' && cell.type !== 'inlineStr') {
    return `<c r="${ref}"${styleAttr}><v>${cell.value}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(
    String(cell.value),
  )}</t></is></c>`
}

function buildWorksheetXml(cells: SheetCell[], options: WorksheetOptions) {
  const rowsMap = new Map<number, SheetCell[]>()
  cells.forEach((cell) => {
    const list = rowsMap.get(cell.row) || []
    list.push(cell)
    rowsMap.set(cell.row, list)
  })

  const maxRow = cells.reduce((max, cell) => Math.max(max, cell.row), 1)

  const rowsXml = Array.from(rowsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([rowNumber, rowCells]) => {
      const cellsXml = rowCells
        .sort((a, b) => a.col - b.col)
        .map((cell) => buildCellXml(cell))
        .join('')
      const customHeightRows: Record<number, number> = {
        1: 21,
        2: 16.5,
        3: 16.5,
        4: 16.5,
        6: 18,
      }
      const heightAttr = customHeightRows[rowNumber]
        ? ` ht="${customHeightRows[rowNumber]}" customHeight="1"`
        : ''
      return `<row r="${rowNumber}"${heightAttr}>${cellsXml}</row>`
    })
    .join('')

  const mergesXml = (options.merges || []).map((m) => `<mergeCell ref="${m}"/>`).join('')

  const validationsXml =
    options.dataValidationStart && options.dataValidationEnd
      ? `<dataValidations count="1"><dataValidation type="custom" allowBlank="0" showErrorMessage="1" errorStyle="stop" errorTitle="Valor inválido" error="Quilometragem fora do padrão. Verifique se não digitou um zero a mais." sqref="H${options.dataValidationStart}:H${options.dataValidationEnd}"><formula1>AND(INDIRECT(\"H\"&ROW())&gt;=INDIRECT(\"I\"&ROW()),INDIRECT(\"H\"&ROW())-INDIRECT(\"I\"&ROW())&lt;=INDIRECT(\"K\"&ROW()))</formula1></dataValidation></dataValidations>`
      : ''

  const conditionalFormatting =
    options.dataValidationStart && options.dataValidationEnd
      ? `<conditionalFormatting sqref="H${options.dataValidationStart}:H${options.dataValidationEnd}"><cfRule type="expression" dxfId="0" priority="1"><formula>NOT(AND(INDIRECT(\"H\"&ROW())&gt;=INDIRECT(\"I\"&ROW()),INDIRECT(\"H\"&ROW())-INDIRECT(\"I\"&ROW())&lt;=INDIRECT(\"K\"&ROW())))</formula></cfRule></conditionalFormatting>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr/>
  <dimension ref="A1:K${Math.max(options.dataValidationEnd || maxRow, maxRow)}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="2" width="35" customWidth="1"/>
    <col min="3" max="3" width="35" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="22" customWidth="1"/>
    <col min="6" max="6" width="12" customWidth="1"/>
    <col min="7" max="7" width="10" customWidth="1"/>
    <col min="8" max="8" width="14" customWidth="1"/>
    <col min="9" max="9" width="14" customWidth="1" hidden="1"/>
    <col min="10" max="10" width="14" customWidth="1" hidden="1"/>
    <col min="11" max="11" width="14" customWidth="1" hidden="1"/>
  </cols>
  <sheetData>${rowsXml}</sheetData>
  ${options.merges?.length ? `<mergeCells count="${options.merges.length}">${mergesXml}</mergeCells>` : ''}
  <sheetProtection sheet="1" objects="1" scenarios="1"/>
  ${conditionalFormatting}
  ${validationsXml}
  <printOptions horizontalCentered="1" verticalCentered="1"/>
  <pageMargins left="0.3937" right="0.3937" top="0.5906" bottom="0.5906" header="0.3149" footer="0.3149"/>
  <pageSetup paperSize="9" orientation="landscape" horizontalDpi="300" verticalDpi="300" scale="100"/>
</worksheet>`
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="165" formatCode="#\,##0 \"km\""/></numFmts>
  <fonts count="6">
    <font><name val="Arial"/><sz val="10"/><color rgb="FF000000"/></font>
    <font><name val="Arial"/><sz val="12"/><color rgb="FF000000"/><b/></font>
    <font><name val="Arial"/><sz val="10"/><color rgb="FF000000"/><b/></font>
    <font><name val="Arial"/><sz val="9"/><color rgb="FF000000"/><b/></font>
    <font><name val="Arial"/><sz val="9"/><color rgb="FF000000"/></font>
    <font><name val="Arial"/><sz val="8"/><color rgb="FF000000"/><i/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE6E6E6"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="20">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="left" vertical="center" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="left" vertical="center"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center" wrapText="1"/><protection locked="0"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1" applyProtection="1"><alignment horizontal="right" vertical="center"/><protection locked="0"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="right" vertical="center"/><protection locked="0"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  <dxfs count="1"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFF4CCCC"/></patternFill></fill><border><left style="thin"><color rgb="FFCC0000"/></left><right style="thin"><color rgb="FFCC0000"/></right><top style="thin"><color rgb="FFCC0000"/></top><bottom style="thin"><color rgb="FFCC0000"/></bottom></border></dxf></dxfs>
</styleSheet>`
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
}

function buildRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
}

function buildWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Checklist" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function buildWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildCorePropsXml() {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

function buildAppPropsXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Checklist</Application>
</Properties>`
}

function addInfoCells(
  cells: SheetCell[],
  row: number,
  labelsAndValues: Array<{ label: string; value: string; isNumber?: boolean }>,
) {
  let col = 1
  labelsAndValues.forEach((item) => {
    cells.push({ row, col, value: item.label, style: 2 })
    cells.push({ row, col: col + 1, value: item.value, style: item.isNumber ? 4 : 3 })
    col += 2
  })
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get('vehicleId')
  const monthParam = searchParams.get('month')
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  if (!vehicleId) {
    return NextResponse.json(
      { error: 'Parâmetro obrigatório ausente: vehicleId.' },
      { status: 400 },
    )
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
        error: 'Informe o mês (YYYY-MM) ou um intervalo válido com startDate e endDate (YYYY-MM-DD).',
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

  const cells: SheetCell[] = []
  const merges: string[] = []

  // Title
  cells.push({ row: 1, col: 1, value: 'RELATÓRIO DE CHECKLIST DIÁRIO', style: 1 })
  merges.push('A1:H1')
  
const costCenterOptions = vehicle.costCenters?.
    map((item) => item.costCenter?.description || item.costCenter?.code)
    .filter(Boolean)
  const costCenterLabel = costCenterOptions?.join(' • ') || vehicle.costCenter || '—'

  addInfoCells(
    cells,
    2,
    [
      { label: 'RAZÃO SOCIAL', value: costCenterLabel },
      { label: 'PROJETO', value: vehicle.sector ?? '—' },
      { label: 'PLACA', value: vehicle.plate ?? '—' },
      { label: 'MODELO', value: vehicle.model ?? '—' },
    ],
  )

  addInfoCells(
    cells,
    3,
    [
      { label: 'TIPO', value: vehicle.type ?? '—' },
      { label: 'KM', value: vehicle.kmCurrent ?? 0, isNumber: true },
      { label: 'PERÍODO DO RELATÓRIO', value: periodLabel },
      { label: 'SITUAÇÃO DO VEÍCULO', value: vehicle.status ?? '—' },
    ],
  )

  addInfoCells(
    cells,
    4,
    [
      {
        label: 'CONDUTOR(ES)',
        value:
          driverSummaries.length > 0
            ? driverSummaries.map((d) => d.name).join(' • ')
            : 'Nenhum condutor informado',
      },
      { label: 'CONTATOS', value: driverSummaries.map((d) => d.email || d.phone || '').filter(Boolean).join(' • ') || '—' },
      { label: 'APTIDÃO', value: driverSummaries.map((d) => d.status?.toUpperCase()).filter(Boolean).join(' • ') || '—' },
      { label: ' ', value: ' ' },
    ],
  )

  // Table header (row 6)
  const headerRow = 6
  const headers = [
    'DATA',
    'ITENS CRÍTICOS',
    'ITENS NÃO CRÍTICOS',
    'FADIGA',
    'CONDUTOR(ES)',
    'APTIDÃO',
    'PONTOS',
    'KM INFORMADO',
    'KM ANTERIOR',
    'KM RODADO',
    'LIMITE KM DIA',
  ]
  headers.forEach((title, index) => {
    cells.push({ row: headerRow, col: index + 1, value: title, style: index < 8 ? 5 : 6 })
  })

  // Body rows
  const startBodyRow = headerRow + 1
  const dataRows = checkins.length > 0 ? checkins : []
  if (dataRows.length === 0) {
    cells.push({ row: startBodyRow, col: 1, value: '—', style: 6 })
    cells.push({ row: startBodyRow, col: 2, value: 'Nenhum registro encontrado', style: 7 })
  }

  dataRows.forEach((checkin, idx) => {
    const row = startBodyRow + idx
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
    const fatigueText = fatigue.isFatigued
      ? fatigue.yesAnswers.length > 0
        ? `Sim (${fatigue.yesAnswers.join(', ')})`
        : 'Sim'
      : 'Não'

     const driverNames = extractDriverNames(checkin.driverName, checkin.driver?.fullName)
    const previousKm = idx > 0 ? dataRows[idx - 1].kmAtInspection : checkin.kmAtInspection

    cells.push({ row, col: 1, value: formatDate(checkin.inspectionDate), style: 13 })
    cells.push({ row, col: 2, value: criticalItems.join('\n') || '—', style: 14 })
    cells.push({ row, col: 3, value: nonCriticalItems.join('\n') || '—', style: 14 })
    cells.push({ row, col: 4, value: fatigueText, style: 17 })
    cells.push({ row, col: 5, value: driverNames.join(' • ') || '—', style: 15 })
    cells.push({ row, col: 6, value: checkin.driverStatus?.toUpperCase() || '—', style: 16 })
    cells.push({ row, col: 7, value: fatigue.score ?? 0, style: 13 })
    cells.push({ row, col: 8, value: checkin.kmAtInspection, style: 18 })
    cells.push({ row, col: 9, value: previousKm, style: 4 })
    cells.push({ row, col: 10, value: checkin.kmAtInspection - previousKm, style: 4 })
    cells.push({ row, col: 11, value: KM_LIMIT_PER_DAY, style: 4 })
  })

  const lastRow = startBodyRow + Math.max(dataRows.length, 1) - 1
   const footerRow = lastRow + 2
  cells.push({ row: footerRow, col: 1, value: 'Documento gerado automaticamente pelo sistema', style: 12 })
  merges.push(`A${footerRow}:H${footerRow}`)


const worksheetXml = buildWorksheetXml(cells, {
    dataValidationStart: dataRows.length > 0 ? startBodyRow : undefined,
    dataValidationEnd: dataRows.length > 0 ? lastRow : undefined,
    merges,
  })
    

  const zip = new JSZip()
  zip.file('[Content_Types].xml', buildContentTypesXml())
  const relsFolder = zip.folder('_rels')
  relsFolder?.file('.rels', buildRelsXml())

  const docProps = zip.folder('docProps')
  docProps?.file('core.xml', buildCorePropsXml())
  docProps?.file('app.xml', buildAppPropsXml())

  const xl = zip.folder('xl')
  xl?.file('workbook.xml', buildWorkbookXml())
  xl?.file('styles.xml', buildStylesXml())
  const xlRels = xl?.folder('_rels')
  xlRels?.file('workbook.xml.rels', buildWorkbookRelsXml())
  const worksheets = xl?.folder('worksheets')
  worksheets?.file('sheet1.xml', worksheetXml)

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  const fileLabel = startDateParam || monthParam || start.toISOString().slice(0, 10)

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="checklist-mensal-${vehicle.plate}-${fileLabel}.xlsx"`,
    },
  })
}
