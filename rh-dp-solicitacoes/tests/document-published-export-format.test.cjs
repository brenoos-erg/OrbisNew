const assert = require('node:assert/strict')
const JSZip = require('jszip')

const {
  DOCUMENT_PUBLISHED_HEADERS,
  buildDocumentsExportFilename,
  buildExcelFriendlyCsv,
  buildPublishedDocumentRows,
  buildPublishedDocumentsXlsx,
  formatDatePtBr,
} = require('../src/lib/documents/exportDocuments')

async function run() {
  assert.equal(formatDatePtBr(new Date('2026-04-28T12:00:00.000Z')), '28/04/2026')
  assert.equal(formatDatePtBr(null), '')

  const rows = buildPublishedDocumentRows([
    {
      publishedAt: new Date('2026-04-20T00:00:00.000Z'),
      code: 'DOC-001',
      revisionNumber: 3,
      title: 'Manual "A"; Segurança\nOperacional',
      ownerCostCenter: '001 - Qualidade',
      author: 'Maria Souza',
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
      status: 'PUBLICADO',
    },
  ])

  const csv = buildExcelFriendlyCsv(DOCUMENT_PUBLISHED_HEADERS, rows)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes(';'))
  assert.ok(csv.includes('"Manual ""A""; Segurança\nOperacional"'))
  assert.ok(csv.includes('20/04/2026'))
  assert.ok(csv.includes('20/10/2026'))

  const emptyCsv = buildExcelFriendlyCsv(DOCUMENT_PUBLISHED_HEADERS, [])
  assert.ok(emptyCsv.includes('Data Publicação;Código;Nº Revisão;Título;Centro Responsável;Elaborador;Vencimento;Status'))

  const xlsx = await buildPublishedDocumentsXlsx(DOCUMENT_PUBLISHED_HEADERS, rows)
  const zip = await JSZip.loadAsync(Buffer.from(xlsx))
  const workbook = await zip.file('xl/workbook.xml').async('string')
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string')

  assert.ok(workbook.includes('sheet name="Documentos Publicados"'))
  assert.ok(sheet.includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'))
  assert.ok(sheet.includes('<autoFilter ref="A1:H2"/>'))
  assert.ok(sheet.includes('width="55"'))
  assert.ok(sheet.includes('Data Publicação'))
  assert.ok(sheet.includes('20/04/2026'))

  const xlsxEmpty = await buildPublishedDocumentsXlsx(DOCUMENT_PUBLISHED_HEADERS, [])
  const zipEmpty = await JSZip.loadAsync(Buffer.from(xlsxEmpty))
  const sheetEmpty = await zipEmpty.file('xl/worksheets/sheet1.xml').async('string')
  assert.ok(sheetEmpty.includes('<autoFilter ref="A1:H1"/>'))

  const fixedName = buildDocumentsExportFilename('xlsx', new Date('2026-04-28T09:05:00.000Z'))
  assert.equal(fixedName, 'documentos-publicados-20260428-0905.xlsx')

  console.log('document-published-export-format behavior ok')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
