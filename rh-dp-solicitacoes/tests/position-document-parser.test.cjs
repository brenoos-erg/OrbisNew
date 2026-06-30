require('ts-node/register');
const assert = require('assert');
const { parsePositionDescriptionText, mapParsedDocumentToPositionPayload } = require('../src/lib/positions/positionDocumentParser');

const dd241 = `Indexador: DD.RH.241 Revisão: 00 Data: 18/06/2026
Cargo: Analista de Logística, Suprimentos e Frotas Pleno
Cargo do Gestor Imediato: Coordenador de Logística Enquadramento: Administrativo
Área/Setor: Logística
CBO: 2527-15
Descrição Sumária: Realizar atividades logísticas.
Conhecimentos/Habilidades necessários: Excel`;
const parsed = parsePositionDescriptionText(dd241);
assert.strictEqual(parsed.indexador, 'DD.RH.241');
assert.strictEqual(parsed.revision, '00');
assert.strictEqual(parsed.documentDate, '2026-06-18');
assert.strictEqual(parsed.name, 'Analista de Logística, Suprimentos e Frotas Pleno');
assert.strictEqual(parsed.cbo, '2527-15');
assert.strictEqual(parsed.managerPosition, 'Coordenador de Logística');
assert.strictEqual(parsed.framing, 'Administrativo');

const dd242 = `Indexador: DD.RH.242 Revisão: 00 Data: 18/06/2026
Cargo Auxiliar de Engenharia
Cargo do Gestor Imediato: Coordenador Técnico Enquadramento: Técnico
CBO: 3121-05`;
const parsed2 = parsePositionDescriptionText(dd242);
assert.strictEqual(parsed2.indexador, 'DD.RH.242');
assert.strictEqual(parsed2.name, 'Auxiliar de Engenharia');
assert.strictEqual(parsed2.cbo, '3121-05');
assert.strictEqual(parsed2.managerPosition, 'Coordenador Técnico');
assert.strictEqual(parsed2.framing, 'Técnico');
assert.strictEqual(mapParsedDocumentToPositionPayload(parsed).requiredKnowledge, 'Excel');
console.log('position-document-parser ok');
