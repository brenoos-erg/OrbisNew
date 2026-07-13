require('ts-node/register')
require('tsconfig-paths/register')
const assert = require('node:assert/strict')
const { validatePrivateSourceFile, normalizePrivateDocumentStorageKey } = require('../src/lib/documents/documentStorage')

const pdf = Buffer.concat([Buffer.from('%PDF'), Buffer.from('\n1 0 obj\n')])
const validatedPdf = validatePrivateSourceFile({ originalName: 'manual.pdf', mimeType: 'application/pdf', buffer: pdf })
assert.equal(validatedPdf.extension, '.pdf')
assert.equal(validatedPdf.mimeType, 'application/pdf')
assert.equal(validatedPdf.sizeBytes, pdf.byteLength)
assert.match(validatedPdf.sha256, /^[a-f0-9]{64}$/)

const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(32)])
const validatedDocx = validatePrivateSourceFile({ originalName: 'procedimento.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx })
assert.equal(validatedDocx.extension, '.docx')

assert.throws(() => validatePrivateSourceFile({ originalName: 'script.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') }), /Extensão/)
assert.throws(() => validatePrivateSourceFile({ originalName: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not-pdf') }), /Assinatura/)
assert.throws(() => normalizePrivateDocumentStorageKey('../escape.pdf'), /inválida/)
assert.throws(() => normalizePrivateDocumentStorageKey(''), /inválida/)

console.log('document-source-file-behavior ok')
