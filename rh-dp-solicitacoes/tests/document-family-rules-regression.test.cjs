const assert = require('node:assert/strict')
const fs = require('node:fs')

const familyRules = fs.readFileSync('src/lib/documents/documentFamilyRules.ts', 'utf8')
const controlledPipeline = fs.readFileSync('src/lib/documents/controlledPdfPipeline.ts', 'utf8')

assert.match(familyRules, /NON_CONTROLLED_PREFIXES = new Set\(\['RQ', 'DOCEXT', 'LEG'\]\)/)
assert.match(familyRules, /CONTROLLED_PREFIXES = new Set\(\['PG', 'IT', 'DD', 'COD', 'MAN', 'POL'\]\)/)
assert.match(familyRules, /return \{ prefix, family: 'non-controlled-native' \}/)
assert.match(familyRules, /return \{ prefix, family: 'controlled-pdf' \}/)
assert.match(controlledPipeline, /resolveDocumentFamilyRule\(access\.documentCode\)/)
assert.match(controlledPipeline, /if \(familyRule\.family === 'non-controlled-native'\)/)
assert.match(controlledPipeline, /finalPdfBuffer = deps\.applyHeader\(finalPdfBuffer, headerLine\)/)

console.log('document-family-rules-regression ok')