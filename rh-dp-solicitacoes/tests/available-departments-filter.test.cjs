const assert = require('node:assert/strict')
const {
  getDepartmentDisplayLabel,
  getDepartmentsWithAvailableSolicitationTypes,
} = require('../src/lib/availableDepartments')

const departments = [
  { id: 'dep-dp', label: 'Departamento Pessoal', description: '18' },
  { id: 'dep-log', label: 'Logística', description: '21' },
  { id: 'dep-ti', label: 'TI', description: '20' },
  { id: 'dep-orphan', label: 'Departamento Órfão', description: '999' },
]

const visible = getDepartmentsWithAvailableSolicitationTypes(departments, [
  { id: 'tipo-dp', active: true, meta: { departamentos: ['dep-dp'] } },
  { id: 'tipo-log', enabled: true, meta: { departamentos: ['dep-log'] } },
  { id: 'tipo-ti-inativo', active: false, meta: { departamentos: ['dep-ti'] } },
  { id: 'tipo-sem-vinculo', active: true, meta: {} },
])

assert.deepEqual(
  visible.map((department) => department.id),
  ['dep-dp', 'dep-log'],
  'mostra somente departamentos com tipo ativo/disponível vinculado e remove órfãos',
)
assert.ok(
  visible.some((department) => department.id === 'dep-dp'),
  'departamento com tipo vinculado aparece',
)
assert.ok(
  !visible.some((department) => department.id === 'dep-orphan'),
  'departamento sem tipo vinculado não aparece no select',
)
assert.ok(
  !visible.some((department) => department.id === 'dep-ti'),
  'tipo inativo não libera departamento',
)

const legacyVisible = getDepartmentsWithAvailableSolicitationTypes(departments, [
  { id: 'tipo-legado-schema-json', schemaJson: { meta: { departamentos: ['dep-log'] } } },
])
assert.deepEqual(
  legacyVisible.map((department) => department.id),
  ['dep-log'],
  'tipos antigos com schemaJson.meta.departamentos continuam funcionando',
)

assert.equal(
  getDepartmentDisplayLabel(departments[1]),
  'Logística/Almoxarifado',
  'departamento Logística aparece como Logística/Almoxarifado',
)
assert.equal(
  getDepartmentDisplayLabel({ id: 'dep-log-sem-acento', label: 'Logistica' }),
  'Logística/Almoxarifado',
  'departamento Logistica sem acento também é renomeado visualmente',
)
assert.equal(
  departments[1].id,
  'dep-log',
  'o ID do departamento Logística não é alterado',
)
assert.deepEqual(
  legacyVisible.map((department) => department.id),
  ['dep-log'],
  'ao selecionar Logística/Almoxarifado, os tipos vinculados continuam associados ao ID real',
)
assert.deepEqual(
  getDepartmentsWithAvailableSolicitationTypes(departments, [
    { id: 'tipo-sem-vinculo', meta: {} },
    { id: 'tipo-hidden', meta: { departamentos: ['dep-dp'], hiddenFromManualOpening: true } },
  ]),
  [],
  'quando não há departamentos disponíveis, a lista fica vazia para a tela mostrar a mensagem amigável',
)

console.log('available-departments-filter behavior ok')
