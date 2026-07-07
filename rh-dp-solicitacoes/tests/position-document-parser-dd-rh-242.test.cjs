require('ts-node/register');
const assert = require('assert');
const { parsePositionDescriptionText } = require('../src/lib/positions/positionDocumentParser');

const ddRh242Text = `
Indexador: DD.RH.242 Revisão: 00 Data: 18/06/2026
Cargo: Auxiliar de Engenharia
Cargo do Gestor Imediato: Coordenador Técnico Enquadramento: Técnico
Área/Setor: Engenharia CBO: 3121-05
Descrição Sumária: Apoio às atividades de engenharia e topografia, realizando levantamentos, conferências e organização de informações técnicas.
Descrição Detalhada: Prestar suporte às atividades técnicas e operacionais de engenharia, topografia e controle de medições, auxiliando na leitura de projetos e preparação de informações.
Escolaridade: Ensino Superior em andamento em Engenharia Civil, Engenharia de Produção, Engenharia de Agrimensura ou áreas afins.
Experiência: Não se aplica.
Conhecimentos/Habilidades necessários: Leitura e interpretação de projetos e conhecimento básicos em Autocad e Civil3D.
Conhecimentos/Habilidades desejáveis: Conhecimento em cálculos de volumes e comparação de superfícies.
Competências humanas Gesto.Com: Comunicação; Atitude; Relacionamento e Saúde e Segurança
Competências funcionais Gesto.Com: Autogestão, Adaptação à Mudança e Domínio Técnico.
Outros: N.A.
Complexidade do cargo
☐ Alta ☐ Média ☒ Baixa
Gestão
☒ Gere a si próprio e suas entregas ☐ Gere equipe direta ☐ Gere área
Acesso a dados confidenciais
☐ Nunca/Raro ☐ Sempre/Frequente ☒ Ocasionalmente
Responsabilidades
☒ Por suas entregas ☐ Por equipe ☐ Por orçamento
`;

const parsed = parsePositionDescriptionText(ddRh242Text);

assert.strictEqual(parsed.indexador, 'DD.RH.242');
assert.strictEqual(parsed.revision, '00');
assert.strictEqual(parsed.documentDate, '2026-06-18');
assert.strictEqual(parsed.name, 'Auxiliar de Engenharia');
assert.strictEqual(parsed.managerPosition, 'Coordenador Técnico');
assert.strictEqual(parsed.framing, 'Técnico');
assert.strictEqual(parsed.areaSector, 'Engenharia');
assert.strictEqual(parsed.cbo, '3121-05');
assert(parsed.summary.startsWith('Apoio às atividades de engenharia e topografia'));
assert(parsed.detailedDescription.startsWith('Prestar suporte às atividades técnicas e operacionais'));
assert.strictEqual(parsed.schooling, 'Ensino Superior em andamento em Engenharia Civil, Engenharia de Produção, Engenharia de Agrimensura ou áreas afins.');
assert.strictEqual(parsed.experience, 'Não se aplica.');
assert.strictEqual(parsed.necessaryKnowledge, 'Leitura e interpretação de projetos e conhecimento básicos em Autocad e Civil3D.');
assert.strictEqual(parsed.desiredKnowledge, 'Conhecimento em cálculos de volumes e comparação de superfícies.');
assert.strictEqual(parsed.humanCompetencies, 'Comunicação; Atitude; Relacionamento e Saúde e Segurança');
assert.strictEqual(parsed.functionalCompetencies, 'Autogestão, Adaptação à Mudança e Domínio Técnico.');
assert.strictEqual(parsed.otherCompetencies, 'N.A.');
assert.strictEqual(parsed.complexity, 'Baixa');
assert.strictEqual(parsed.managementScope, 'Gere a si próprio e suas entregas');
assert.strictEqual(parsed.confidentialDataAccess, 'Ocasionalmente');
assert.strictEqual(parsed.responsibilities, 'Por suas entregas');

console.log('position-document-parser-dd-rh-242 ok');
