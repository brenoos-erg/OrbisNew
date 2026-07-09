const assert = require('node:assert/strict')
const fs = require('node:fs')
const source = fs.readFileSync('src/lib/documents/controlledPdfPipeline.ts', 'utf8')

for (const stage of ['FILE_NOT_FOUND','SOURCE_READ_FAILED','CONVERSION_FAILED','INTERMEDIATE_PDF_INVALID','WATERMARK_FAILED','HEADER_FAILED','FINAL_PDF_INVALID','UNSUPPORTED_SOURCE']) {
  assert(source.includes(stage), `pipeline deve registrar etapa ${stage}`)
}
assert.match(source, /class ControlledPdfPipelineError extends Error|export class ControlledPdfPipelineError extends Error/)
assert.match(source, /logAndThrowControlledPdfError\('FILE_NOT_FOUND'[\s\S]*versionId[\s\S]*fileUrl: access\.fileUrl[\s\S]*resolvedFileUrl: pathResolution\.resolvedFileUrl[\s\S]*absolutePath: pathResolution\.absolutePath[\s\S]*attemptedAbsolutePaths: pathResolution\.attemptedAbsolutePaths/)
assert.match(source, /if \(bufferLooksLikePdf\)[\s\S]*pdfSourceBuffer = Buffer\.from\(sourceBuffer\)[\s\S]*} else if \(sourceType\.isConvertibleToPdf\)/)
assert.match(source, /deps\.convertToPdf\([\s\S]*logAndThrowControlledPdfError\('CONVERSION_FAILED'/)
assert.match(source, /const convertedValidation = deps\.validatePdf\(pdfSourceBuffer\)[\s\S]*logAndThrowControlledPdfError\('INTERMEDIATE_PDF_INVALID'/)
assert.match(source, /deps\.applyWatermark\(pdfSourceBuffer\)[\s\S]*logAndThrowControlledPdfError\('WATERMARK_FAILED'/)
assert.match(source, /deps\.applyHeader\(finalPdfBuffer, headerLine\)[\s\S]*logAndThrowControlledPdfError\('HEADER_FAILED'/)
assert.match(source, /const finalValidation = deps\.validatePdf\(finalPdfBuffer\)[\s\S]*logAndThrowControlledPdfError\('FINAL_PDF_INVALID'/)
console.log('document-controlled-pdf-pipeline ok')
