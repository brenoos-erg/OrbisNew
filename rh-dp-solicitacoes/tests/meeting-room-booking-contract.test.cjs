const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const featureKeys = read('src/lib/featureKeys.ts')
assert.match(featureKeys, /AGENDAMENTO_SALAS:\s*'agendamento-salas'/, 'MODULE_KEYS deve conter AGENDAMENTO_SALAS')
for (const key of ['ACESSAR', 'MARCAR', 'VISUALIZAR', 'CANCELAR']) {
  assert.match(featureKeys, new RegExp(`${key}:\\s*'AGENDAMENTO_SALAS\\.${key}'`), `FEATURE_KEYS deve conter ${key}`)
}

const schema = read('prisma/schema.prisma')
assert.match(schema, /model\s+MeetingRoomBooking\s+{/, 'schema deve conter MeetingRoomBooking')
assert.match(schema, /enum\s+MeetingRoomName\s+{[\s\S]*OURO[\s\S]*SOLAR[\s\S]*DIAMANTE/, 'schema deve conter salas')

const api = read('src/app/api/agendamento-salas/route.ts')
assert.match(api, /startsAt:\s*{\s*lt:\s*endsAt\s*}/, 'API deve buscar conflito por início antes do fim novo')
assert.match(api, /endsAt:\s*{\s*gt:\s*startsAt\s*}/, 'API deve buscar conflito por fim depois do início novo')
assert.match(api, /status:\s*'AGENDADA'/, 'API deve considerar somente agendamentos ativos no conflito')
assert.match(api, /status:\s*409/, 'API deve retornar 409 em conflito')

const page = read('src/app/dashboard/agendamento-salas/page.tsx')
assert.match(page, /Marcar reunião/, 'página deve conter aba Marcar reunião')
assert.match(page, /Visualização/, 'página deve conter aba Visualização')
assert.match(page, /label: 'Ouro'/, 'página deve exibir Sala Ouro')
assert.match(page, /label: 'Solar'/, 'página deve exibir Sala Solar')
assert.match(page, /label: 'Diamante'/, 'página deve exibir Sala Diamante')

const sidebar = read('src/components/layout/Sidebar.tsx')
assert.match(sidebar, /Agendamento de Salas/, 'Sidebar deve conter Agendamento de Salas')
assert.match(sidebar, /\/dashboard\/agendamento-salas/, 'Sidebar deve conter rota do módulo')

console.log('meeting-room-booking contract ok')
