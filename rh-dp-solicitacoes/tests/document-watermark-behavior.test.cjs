const assert = require('node:assert/strict')

const {
  applyUncontrolledCopyWatermark,
  hasUncontrolledCopyWatermark,
  validatePdfBuffer,
} = require('../src/lib/pdf/uncontrolledCopyWatermark')

const twoPagePdf = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>
endobj
%%EOF
`, 'latin1')

const validation = validatePdfBuffer(twoPagePdf)
assert.equal(validation.valid, true)

const output = applyUncontrolledCopyWatermark(twoPagePdf)
assert.equal(validatePdfBuffer(output).valid, true)
assert.equal(hasUncontrolledCopyWatermark(output), true)

const rendered = output.toString('latin1')
const watermarkStreams = (rendered.match(/\/GSWm gs/g) || []).length
assert.equal(watermarkStreams, 2, 'watermark should be injected on every page')
const watermarkTextDrawCommands = (rendered.match(/\(CÓPIA CONTROLADA\) Tj/g) || []).length
assert.equal(watermarkTextDrawCommands, 2, 'watermark text should be drawn once per page')

const badPdf = Buffer.from('%PDF-1.4\nsem eof', 'latin1')
const badValidation = validatePdfBuffer(badPdf)
assert.equal(badValidation.valid, false)

console.log('document-watermark-behavior ok')