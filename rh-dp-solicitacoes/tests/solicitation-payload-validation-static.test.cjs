const assert = require('node:assert')
const fs = require('node:fs')

function collectFieldDefs(schemaJson) {
  return ['fields', 'campos', 'camposEspecificos'].flatMap((key) => Array.isArray(schemaJson?.[key]) ? schemaJson[key] : [])
}
function readPayloadValue(payload, fieldName) {
  if (payload.campos && Object.prototype.hasOwnProperty.call(payload.campos, fieldName)) return payload.campos[fieldName]
  return payload[fieldName]
}
function missingRequired(schemaJson, payload) {
  return collectFieldDefs(schemaJson)
    .filter((field) => field.required === true || field.obrigatorio === true)
    .filter((field) => {
      const name = field.name ?? field.key ?? field.field
      const value = readPayloadValue(payload, name)
      return value === undefined || value === null || value === ''
    })
    .map((field) => field.name ?? field.key ?? field.field)
}

const schema = {
  fields: [{ name: 'diretoObrigatorio', required: true }],
  campos: [{ name: 'campoObrigatorio', required: true }],
  camposEspecificos: [{ name: 'seedObrigatorio', required: true }],
}
assert.deepStrictEqual(missingRequired(schema, { diretoObrigatorio: 'ok', campos: { campoObrigatorio: 'ok', seedObrigatorio: 'ok' } }), [])
assert.deepStrictEqual(missingRequired(schema, { diretoObrigatorio: 'ok', campoObrigatorio: 'ok', campos: {} }), ['seedObrigatorio'])

const seed = fs.readFileSync('prisma/seed.ts', 'utf8')
assert(seed.includes('camposEspecificos'), 'Seed deve conter camposEspecificos')
assert(seed.includes('required: true'), 'Seed deve conter campos obrigatórios')
const validator = fs.readFileSync('src/lib/solicitationPayloadValidation.ts', 'utf8')
assert(validator.includes('collectFieldDefs') && validator.includes('camposEspecificos'), 'Validador deve coletar campos obrigatórios do seed')
console.log('solicitation-payload-validation-static ok')
