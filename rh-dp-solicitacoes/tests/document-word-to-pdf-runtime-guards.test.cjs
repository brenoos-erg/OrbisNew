const assert = require('node:assert/strict')
const fs = require('node:fs')

const wordToPdf = fs.readFileSync('src/lib/documents/wordToPdf.ts', 'utf8')

assert.match(wordToPdf, /C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice\.exe/)
assert.match(wordToPdf, /C:\\\\Program Files \(x86\)\\\\LibreOffice\\\\program\\\\soffice\.exe/)
assert.match(wordToPdf, /soffice-output/)
assert.match(wordToPdf, /fs\.mkdtemp\(path\.join\(os\.tmpdir\(\), 'word-to-pdf-'\)\)/)
assert.match(wordToPdf, /await fs\.copyFile\(sourceAbsolutePath, tempInputPath\)/)
assert.match(wordToPdf, /--convert-to', 'pdf:writer_pdf_Export'/)
assert.match(wordToPdf, /fallbackPdfName/)
assert.match(wordToPdf, /using-derived-cache/)
assert.match(wordToPdf, /cache-invalid-reconvert/)
assert.match(wordToPdf, /await fs\.rm\(tempDir, \{ recursive: true, force: true \}\)/)

console.log('document-word-to-pdf-runtime-guards ok')