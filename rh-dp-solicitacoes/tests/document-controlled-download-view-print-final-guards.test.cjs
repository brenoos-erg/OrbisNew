const assert = require('node:assert/strict')
const fs = require('node:fs')

const controlledAction = fs.readFileSync('src/lib/documents/controlledAction.ts', 'utf8')
const fileRoute = fs.readFileSync('src/app/api/documents/versions/[versionId]/file/route.ts', 'utf8')
const controlledPipeline = fs.readFileSync('src/lib/documents/controlledPdfPipeline.ts', 'utf8')
const printClient = fs.readFileSync('src/app/documentos/impressao/[versionId]/impressao-documento-client.tsx', 'utf8')

assert.match(controlledAction, /downloadUrl:\s*`\/api\/documents\/versions\/\$\{input\.versionId\}\/file\?disposition=attachment&auditAction=\$\{intentUpper\}`/)
assert.match(controlledAction, /url:\s*`\/api\/documents\/versions\/\$\{input\.versionId\}\/file\?disposition=inline&auditAction=\$\{intentUpper\}`/)
assert.match(controlledAction, /printUrl:\s*`\/documentos\/impressao\/\$\{input\.versionId\}`/)
assert.doesNotMatch(controlledAction, /\/download['"`]/)
assert.doesNotMatch(controlledAction, /\/view['"`]/)
assert.doesNotMatch(controlledAction, /\/print['"`]/)

assert.match(fileRoute, /const disposition = .*attachment.*inline/)
assert.match(fileRoute, /const resolved = await buildControlledPdf\(versionId, me\.id, intent\)/)
assert.match(fileRoute, /'Content-Type': resolved\.mimeType/)
assert.match(fileRoute, /'X-Document-Watermark': resolved\.watermarkApplied \? 'CÓPIA CONTROLADA' : 'UNAVAILABLE'/)

assert.match(controlledPipeline, /mimeType:\s*DOCUMENT_PDF_MIME/)
assert.match(controlledPipeline, /if \(!watermarkApplied\)\s*{\s*finalPdfBuffer = deps\.applyWatermark\(pdfSourceBuffer\)/s)
assert.match(controlledPipeline, /const finalValidation = deps\.validatePdf\(finalPdfBuffer\)/)

assert.match(printClient, /intent: 'print'/)
assert.match(printClient, /window\.location\.replace\(/)
assert.doesNotMatch(printClient, /dashboard\/controle-documentos/)

console.log('document-controlled-download-view-print-final-guards ok')