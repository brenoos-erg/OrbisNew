import JSZip from 'jszip'

type ExportDocumentRow = {
  publishedAt: Date | null
  code: string
  revisionNumber: number
  title: string
  ownerCostCenter: string
  author: string
  expiresAt: Date | null
  status: string
}

export const DOCUMENT_PUBLISHED_HEADERS = [
  'Data Publicação',
  'Código',
  'Nº Revisão',
  'Título',
  'Centro Responsável',
  'Elaborador',
  'Vencimento',
  'Status',
] as const

const XLSX_COLUMN_WIDTHS = [18, 22, 12, 55, 28, 30, 18, 18]

function escapeCsvCell(value: string) {
  const escaped = value.replaceAll('"', '""')
  return /[;\n\r"]/u.test(escaped) ? `"${escaped}"` : escaped
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function toColumnName(index: number) {
  let value = index
  let column = ''

  while (value >= 0) {
    column = String.fromCharCode((value % 26) + 65) + column
    value = Math.floor(value / 26) - 1
  }

  return column
}

function toSheetRowsXml(rows: string[][]) {
  return rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1
      const cells = row
        .map((cell, cellIndex) => {
          const reference = `${toColumnName(cellIndex)}${rowNumber}`
          const style = rowIndex === 0 ? ' s="1"' : cellIndex === 3 ? ' s="2"' : ''
          return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')

      return `<row r="${rowNumber}">${cells}</row>`
    })
    .join('')
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment wrapText="1" vertical="top"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
}

function buildWorkbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Documentos Publicados" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function buildWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
}

function buildSheetXml(rows: string[][]) {
  const totalRows = rows.length
  const lastCell = `H${Math.max(totalRows, 1)}`
  const cols = XLSX_COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>${cols}</cols>
  <sheetData>${toSheetRowsXml(rows)}</sheetData>
  <autoFilter ref="A1:${lastCell}"/>
</worksheet>`
}

export function formatDatePtBr(value: Date | null) {
  if (!value) return ''
  const day = String(value.getDate()).padStart(2, '0')
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const year = value.getFullYear()
  return `${day}/${month}/${year}`
}

export function buildPublishedDocumentRows(rows: ExportDocumentRow[]) {
  return rows.map((row) => [
    formatDatePtBr(row.publishedAt),
    row.code,
    String(row.revisionNumber),
    row.title,
    row.ownerCostCenter,
    row.author,
    formatDatePtBr(row.expiresAt),
    row.status,
  ])
}

export function buildExcelFriendlyCsv(headers: readonly string[], rows: string[][]) {
  const body = [Array.from(headers), ...rows]
    .map((line) => line.map((value) => escapeCsvCell(value)).join(';'))
    .join('\n')

  return `\uFEFF${body}`
}

export async function buildPublishedDocumentsXlsx(headers: readonly string[], rows: string[][]) {
  const zip = new JSZip()
  const allRows = [Array.from(headers), ...rows]

  zip.file('[Content_Types].xml', buildContentTypesXml())
  zip.file('_rels/.rels', buildRootRelsXml())
  zip.file('xl/workbook.xml', buildWorkbookXml())
  zip.file('xl/_rels/workbook.xml.rels', buildWorkbookRelsXml())
  zip.file('xl/styles.xml', buildStylesXml())
  zip.file('xl/worksheets/sheet1.xml', buildSheetXml(allRows))

  return zip.generateAsync({ type: 'uint8array' })
}

export function buildDocumentsExportFilename(extension: 'csv' | 'xlsx', now = new Date()) {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `documentos-publicados-${date}-${time}.${extension}`
}
