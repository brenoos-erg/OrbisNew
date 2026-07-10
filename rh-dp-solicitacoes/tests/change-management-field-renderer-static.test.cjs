const assert = require('assert');
const { read, assertIncludesAll } = require('./change-management-test-utils.cjs');
const source = read('src/app/dashboard/solicitacoes/enviadas/nova/page.tsx');

assertIncludesAll(source, [
  "normalizedType === 'multi_select'",
  'handleMultiSelectChange',
  'type="checkbox"',
  'normalizeRuleValueList',
], 'renderer multi_select');
assertIncludesAll(source, [
  "normalizedType === 'risk_matrix'",
  'handleRiskMatrixChange',
  'detalheComplemento',
  'responseOptions',
], 'renderer risk_matrix');
assertIncludesAll(source, [
  "normalizedType === 'repeater'",
  'addObjectRow',
  'updateObjectRow',
  'removeObjectRow',
], 'renderer repeater');
assertIncludesAll(source, [
  "normalizedType === 'action_plan'",
  'itemOrdem',
  'dataInicial',
  'dataFinal',
  'evidencias',
], 'renderer action_plan');
assertIncludesAll(source, [
  "normalizedType === 'approval_grid'",
  'aria-readonly="true"',
  'observacaoJustificativa',
], 'renderer approval_grid');
assertIncludesAll(source, [
  'requiredWhen',
  'matchesConditionalRule',
  'isCampoRequired',
  'rule.includes',
  'rule.equals',
], 'renderer requiredWhen');
assert.match(source, /const faltantes = obrigatoriosTexto\.filter\(\(name\) => !hasFieldValue\(extras\[name\]\)\)/, 'validação deve aceitar strings, arrays e listas/objetos');
assert.match(source, /const isCampoRequired = \(campo: CampoEspecifico\) =>\s*Boolean\(campo\.required \|\| \(campo\.requiredWhen \? matchesConditionalRule\(campo\.requiredWhen\) : false\)\)/, 'campo com required true deve ser obrigatório e requiredWhen só deve ser aplicado quando existir');
assert.match(source, /if \(!rule\?\.field\) return true/, 'visibleWhen sem regra deve continuar visível pelo matchesConditionalRule');
assert.doesNotMatch(source, /Boolean\(campo\.required \|\| matchesConditionalRule\(campo\.requiredWhen\)\)/, 'campo sem required e sem requiredWhen não pode virar obrigatório');

const requiredTrueCampo = { required: true };
const requiredWhenSatisfiedCampo = { requiredWhen: { field: 'tiposMudanca', includes: 'Outras' } };
const optionalCampo = {};
const extras = { tiposMudanca: 'Técnica, Outras' };
const normalizeRuleValueList = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
const matchesConditionalRule = (rule) => {
  if (!rule?.field) return true;
  const currentValue = extras[rule.field];
  if (rule.equals !== undefined) return String(currentValue ?? '') === rule.equals;
  if (rule.includes !== undefined) return normalizeRuleValueList(currentValue).includes(rule.includes);
  return true;
};
const isCampoRequired = (campo) => Boolean(campo.required || (campo.requiredWhen ? matchesConditionalRule(campo.requiredWhen) : false));
assert.strictEqual(isCampoRequired(requiredTrueCampo), true, 'campo com required: true é obrigatório');
assert.strictEqual(isCampoRequired(requiredWhenSatisfiedCampo), true, 'campo com requiredWhen satisfeito é obrigatório');
assert.strictEqual(isCampoRequired(optionalCampo), false, 'campo sem required e sem requiredWhen NÃO é obrigatório');
assert.strictEqual(matchesConditionalRule(undefined), true, 'visibleWhen sem regra continua visível');
console.log('change management field renderer static ok');
