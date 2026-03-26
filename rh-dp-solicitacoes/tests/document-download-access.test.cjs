const assert = require('node:assert/strict')
const fs = require('node:fs')

const route = fs.readFileSync('src/app/api/documents/versions/[versionId]/download/route.ts', 'utf8')

assert.match(route, /Sem acesso ao documento/)
assert.match(route, /userModuleAccess\.findFirst/)
assert.match(route, /userDepartment\.findFirst/)
assert.match(route, /ownerDepartmentId === me\.departmentId/)

console.log('document-download-access ok')