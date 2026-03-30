const assert = require('node:assert/strict')
const fs = require('node:fs')

const api = fs.readFileSync('src/app/api/sst/nao-conformidades/alertas-config/route.ts', 'utf8')
assert.match(api, /me\.role !== 'ADMIN'/)
assert.match(api, /subjectTemplate/)
assert.match(api, /bodyTemplate/)

const ui = fs.readFileSync('src/app/dashboard/sst/nao-conformidades/NaoConformidadesClient.tsx', 'utf8')
assert.match(ui, /Alertas de NC \(Admin\)/)

console.log('nc-alert-admin-config ok')