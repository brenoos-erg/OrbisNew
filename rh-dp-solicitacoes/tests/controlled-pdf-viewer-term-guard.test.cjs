const assert = require('node:assert/strict')
const fs = require('node:fs')

const source = fs.readFileSync('src/components/documents/ControlledPdfViewer.tsx', 'utf8')

assert.match(source, /fetchControlledAction/)
assert.match(source, /requiresTerm/)
assert.match(source, /api\/documents\/term\/accept/)
assert.doesNotMatch(source, /window\.location\.href\s*=\s*`?\$\{endpointBase\}\?action=download/)
assert.doesNotMatch(source, /window\.open\(\s*`?\$\{endpointBase\}\?action=print/)

console.log('controlled-pdf-viewer-term-guard ok')