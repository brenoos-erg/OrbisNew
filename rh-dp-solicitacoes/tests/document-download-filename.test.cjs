const assert = require('node:assert/strict')
const fs = require('node:fs')

const {
  buildContentDispositionHeader,
  buildDocumentDownloadFilename,
  sanitizeDownloadFilename,
} = require('../src/lib/documents/documentDownloadFilename')

assert.equal(
  buildDocumentDownloadFilename({
    code: 'PG.ENG.010',
    title: 'SERVIÇOS TOPOGRÁFICOS DE CAMPO',
    revisionNumber: 2,
    mimeType: 'application/pdf',
  }),
  'PG.ENG.010 - SERVIÇOS TOPOGRÁFICOS DE CAMPO - Rev.02.pdf',
)

assert.match(buildDocumentDownloadFilename({ code: 'PG', title: 'Teste', revisionNumber: 0, mimeType: 'application/pdf' }), /Rev\.00\.pdf$/)
assert.match(buildDocumentDownloadFilename({ code: 'PG', title: 'Teste', revisionNumber: 1, mimeType: 'application/pdf' }), /Rev\.01\.pdf$/)
assert.match(buildDocumentDownloadFilename({ code: 'PG', title: 'Teste', revisionNumber: 10, mimeType: 'application/pdf' }), /Rev\.10\.pdf$/)

assert.equal(
  buildDocumentDownloadFilename({
    code: 'IT.RH.005',
    title: 'ADMISSÃO DE COLABORADORES',
    revisionNumber: 1,
    originalFilename: 'arquivo.docx',
  }),
  'IT.RH.005 - ADMISSÃO DE COLABORADORES - Rev.01.docx',
)

assert.equal(
  buildDocumentDownloadFilename({
    code: 'IT.RH.006',
    title: 'CONTRATO DE TRABALHO',
    revisionNumber: 3,
    originalFilename: 'arquivo.doc',
  }),
  'IT.RH.006 - CONTRATO DE TRABALHO - Rev.03.doc',
)

const invalidCharsFilename = buildDocumentDownloadFilename({
  code: 'RQ.SST.043',
  title: 'REQUISIÇÃO DE EPI \\ / : * ? " < > | UNIFORMES?',
  revisionNumber: 0,
  mimeType: 'application/pdf',
})
assert.equal(invalidCharsFilename, 'RQ.SST.043 - REQUISIÇÃO DE EPI UNIFORMES - Rev.00.pdf')
assert.equal(sanitizeDownloadFilename('\n\t'), 'documento')

assert.equal(
  buildDocumentDownloadFilename({
    code: 'PG.ENG.010',
    title: 'SERVIÇOS TOPOGRÁFICOS DE CAMPO',
    revisionNumber: 2,
    mimeType: 'application/pdf',
    storedPath: '/uploads/documents/pdf-mqlalo3s-318f828e7f.pdf',
    originalFilename: 'pdf-mqlalo3s-318f828e7f.pdf',
  }),
  'PG.ENG.010 - SERVIÇOS TOPOGRÁFICOS DE CAMPO - Rev.02.pdf',
)

const disposition = buildContentDispositionHeader('PG.ENG.010 - SERVIÇOS TOPOGRÁFICOS DE CAMPO - Rev.02.pdf')
assert.match(disposition, /^attachment/)
assert.match(disposition, /filename="PG\.ENG\.010 - SERVIÇOS TOPOGRÁFICOS DE CAMPO - Rev\.02\.pdf"/)
assert.match(disposition, /filename\*=UTF-8''PG\.ENG\.010%20-%20SERVI%C3%87OS%20TOPOGR%C3%81FICOS%20DE%20CAMPO%20-%20Rev\.02\.pdf/)

const controlledRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/controlled/route.ts', 'utf8')
assert.match(controlledRoute, /buildDocumentDownloadFilename/)
assert.match(controlledRoute, /buildContentDispositionHeader\(downloadFilename\)/)
assert.match(controlledRoute, /action === 'download'/)

console.log('document-download-filename ok')
