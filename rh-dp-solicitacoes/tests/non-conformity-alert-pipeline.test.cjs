const assert = require('node:assert/strict')

const { renderNcAlertTemplate } = require('../src/lib/sst/nonConformityAlertTemplate')

const template = 'NC {{numeroRnc}} - {{status}} - {{responsavel}}'
const rendered = renderNcAlertTemplate(template, {
  numeroRnc: 'RNC-2026-0001',
  status: 'ABERTA',
  responsavel: 'João Silva',
})

assert.equal(rendered, 'NC RNC-2026-0001 - ABERTA - João Silva')
assert.equal(renderNcAlertTemplate('Campo ausente {{naoExiste}}', {}), 'Campo ausente ')

console.log('non-conformity-alert-pipeline behavior ok')