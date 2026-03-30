const assert = require('node:assert/strict')
const fs = require('node:fs')

const departments = fs.readFileSync('src/lib/officialDepartment.ts', 'utf8')
for (const name of [
  'Comunicação',
  'Departamento Pessoal',
  'Diretoria',
  'Controladoria',
  'Financeiro',
  'Tecnologia da Informação',
  'Jurídico',
  'Meio Ambiente',
  'Comercial',
  'Qualidade',
  'Recursos Humanos',
  'Responsabilidade Social',
  'Engenharia e Projetos',
  'Segurança do Trabalho',
  'Escritório Mariana',
  'Logística',
  'Administrativo',
  'Contabilidade',
  'Almoxarifado',
]) {
  assert.match(departments, new RegExp(name))
}

console.log('official-departments-list ok')