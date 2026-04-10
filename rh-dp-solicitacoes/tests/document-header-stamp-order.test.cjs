const assert = require('node:assert/strict')
const { applyDocumentHeaderStamp } = require('../src/lib/pdf/documentHeaderStamp')

const SAMPLE_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 31 >>
stream
q
1 1 1 rg
0 0 595 842 re f
Q
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000221 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
310
%%EOF`

const stamped = applyDocumentHeaderStamp(Buffer.from(SAMPLE_PDF, 'latin1'), 'Código: POL.QUA.001')
const rendered = stamped.toString('latin1')

const pageObject = rendered.match(/3\s+0\s+obj([\s\S]*?)endobj/)
assert.ok(pageObject, 'Página precisa existir no PDF estampado')

const contentsMatch = pageObject[1].match(/\/Contents\s*\[([^\]]+)\]/)
assert.ok(contentsMatch, 'Conteúdo da página precisa estar no formato de array')

const refs = contentsMatch[1]
assert.ok(/4\s+0\s+R/.test(refs), 'Referência original do conteúdo deve permanecer')
const allRefs = Array.from(refs.matchAll(/(\d+)\s+0\s+R/g)).map((m) => Number(m[1]))
assert.ok(allRefs.length >= 2, 'Array de contents deve conter stream original e stream de cabeçalho')
assert.equal(allRefs[0], 4, 'Stream original deve vir primeiro para que o cabeçalho seja desenhado por último')

console.log('document-header-stamp-order ok')