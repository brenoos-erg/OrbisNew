require('ts-node').register({ transpileOnly:true, compilerOptions:{module:'CommonJS', moduleResolution:'node'}})
require('tsconfig-paths/register')
const assert=require('node:assert/strict')
const { normalizeSectorKey, isNadaConstaSolicitation, extractNadaConstaSectorKeys, userCanSeeNadaConstaBySector } = require('../src/lib/solicitationVisibility')

assert.equal(normalizeSectorKey('Saúde Ocupacional'),'saude ocupacional')
assert.equal(normalizeSectorKey('Segurança do Trabalho'),'seguranca do trabalho')
assert.equal(normalizeSectorKey('SST'),'seguranca do trabalho')
assert.equal(normalizeSectorKey('Saúde'),'saude ocupacional')
assert.equal(isNadaConstaSolicitation({tipo:{nome:'Nada Consta DP'}}),true)
assert.deepEqual(extractNadaConstaSectorKeys({solicitacaoSetores:[{setor:'Saúde Ocupacional'}]}),['saude ocupacional'])
assert.deepEqual(extractNadaConstaSectorKeys({payload:{setoresResponsaveis:['SST']}}),['seguranca do trabalho'])
assert.deepEqual(extractNadaConstaSectorKeys({payload:{dados:{area:{nome:'Segurança'}}}}),['seguranca do trabalho'])

const neciley={userDepartmentNamesNormalized:['saude ocupacional','seguranca do trabalho'],userSectorNamesNormalized:['saude ocupacional','seguranca do trabalho'],userCostCenterIds:['580'],userDepartmentIds:['19','21']}
assert.equal(userCanSeeNadaConstaBySector(neciley,{tipo:{nome:'Nada Consta'},solicitacaoSetores:[{setor:'Saúde Ocupacional'}]}),true)
assert.equal(userCanSeeNadaConstaBySector(neciley,{tipo:{nome:'Nada Consta'},solicitacaoSetores:[{setor:'Segurança do Trabalho'}]}),true)
assert.equal(userCanSeeNadaConstaBySector(neciley,{tipo:{nome:'Nada Consta'},payload:{setores:['SST']}}),true)
assert.equal(userCanSeeNadaConstaBySector(neciley,{tipo:{nome:'Nada Consta'},payload:{setores:['Financeiro']}}),false)

console.log('nada-consta-visibility tests: ok')
