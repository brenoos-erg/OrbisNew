const assert = require('node:assert/strict')

const { OFFICIAL_DEPARTMENTS, OFFICIAL_DEPARTMENT_CODES, validateOfficialDepartments } = require('../src/lib/officialDepartment')

const validation = validateOfficialDepartments(OFFICIAL_DEPARTMENTS)
assert.equal(validation.valid, true)
assert.equal(validation.duplicateCodes.length, 0)
assert.equal(validation.duplicateSiglas.length, 0)

assert.equal(OFFICIAL_DEPARTMENT_CODES.length, OFFICIAL_DEPARTMENTS.length)
assert.ok(OFFICIAL_DEPARTMENT_CODES.includes('22'))
assert.ok(OFFICIAL_DEPARTMENT_CODES.includes('26'))

console.log('official-departments-list behavior ok')