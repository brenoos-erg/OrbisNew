const assert = require('assert');
const { seed, assertIncludesAll } = require('./change-management-test-utils.cjs');
const source = seed();
assert.match(source, /requiresActionPlan:\s*true/, 'Gestão de Mudanças deve exigir/vincular plano de ação');
assert.match(source, /type:\s*'action_plan'[\s\S]*allowMultiple:\s*true/, 'plano de ação deve ser estrutura própria e permitir múltiplas ações');
assertIncludesAll(source, ['linkedEntity', 'Solicitation', 'itemOrdem', 'acao', 'responsavel', 'dataInicial', 'dataFinal', 'status', 'evidencias'], 'plano de ação RQ.QUA.148');
console.log('change management action plan static ok');
