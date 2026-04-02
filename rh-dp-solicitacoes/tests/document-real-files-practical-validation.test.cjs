const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const {
  applyUncontrolledCopyWatermark,
  hasUncontrolledCopyWatermark,
  validatePdfBuffer,
} = require('../src/lib/pdf/uncontrolledCopyWatermark')
const { resolveDocumentFileType } = require('../src/lib/documents/fileType')

const controlledPipelineSource = fs.readFileSync('src/lib/documents/controlledPdfPipeline.ts', 'utf8')
const controlledActionSource = fs.readFileSync('src/lib/documents/controlledAction.ts', 'utf8')

const nativePdfPath = path.join('public', 'uploads', 'documents', '1774894753457-3581b198-75fc-4192-9078-0bb5b39a540c-APE---Greison-da-silva.pdf')
const realDocxPath = path.join('public', 'checklist-ABC1A34-2025-12-01 (3).docx')
const realDocPathWithSpaces = '/uploads/documents/Arquivo de teste muito grande para validar nomes longos e espaços na conversão final.doc'

const nativePdf = fs.readFileSync(nativePdfPath)
const realDocx = fs.readFileSync(realDocxPath)

const pdfValidation = validatePdfBuffer(nativePdf)
assert.equal(pdfValidation.valid, true, 'PDF nativo real precisa ser válido')

const watermarkedPdf = applyUncontrolledCopyWatermark(nativePdf)
assert.equal(validatePdfBuffer(watermarkedPdf).valid, true, 'PDF com watermark precisa continuar válido')
assert.equal(hasUncontrolledCopyWatermark(watermarkedPdf), true, 'watermark deve existir no PDF final')

const renderedPdf = watermarkedPdf.toString('latin1')
const watermarkStreams = (renderedPdf.match(/\/GSWm gs/g) || []).length
const nativePages = (nativePdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
assert.ok(
  watermarkStreams >= Math.max(1, nativePages),
  `watermark deve cobrir todas as páginas (streams=${watermarkStreams}, pages=${nativePages})`,
)

const docxMeta = resolveDocumentFileType(realDocxPath)
assert.equal(docxMeta.extension, '.docx')
assert.equal(docxMeta.isWord, true)
assert.equal(docxMeta.isConvertibleToPdf, true)

assert.ok(realDocx.length > 0, 'arquivo DOCX real precisa existir e não ser vazio')

const docMeta = resolveDocumentFileType(realDocPathWithSpaces)
assert.equal(docMeta.extension, '.doc')
assert.equal(docMeta.isWord, true)
assert.equal(docMeta.isConvertibleToPdf, true)

assert.match(controlledPipelineSource, /decodeURIComponent\(slashNormalized\)/)
assert.match(controlledPipelineSource, /path\.join\(process\.cwd\(\), 'public', \.\.\.relativeToPublic\.split\('\/'\)\)/)

assert.match(controlledActionSource, /type ControlledActionDeps =/)
assert.match(controlledActionSource, /executeControlledDocumentActionWithDeps\(/)
assert.match(controlledActionSource, /if \('termChallenge' in resolved\) return \{ termChallenge: resolved\.termChallenge, status: resolved\.status \}/)
assert.match(controlledActionSource, /downloadUrl:\s*`\/api\/documents\/versions\/\$\{input\.versionId\}\/file\?disposition=attachment&auditAction=\$\{intentUpper\}`/)

console.log('document-real-files-practical-validation ok')