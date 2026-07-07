require('ts-node/register');
const assert = require('assert');
const { parsePositionDescriptionText } = require('../src/lib/positions/positionDocumentParser');

const ddRh241Text = `
Indexador: DD.RH.241 Revisão: 00 Data: 18/06/2026
Cargo: Analista de Logística, Suprimentos e Frotas Pleno
Cargo do Gestor Imediato: Coordenador de Logística e Suprimentos Enquadramento: Administrativo
Área/Setor: Logística CBO: 2527-15
Descrição Sumária: Responsável por otimizar a performance operacional e financeira da frota, suprimentos e logística interna da empresa.
Descrição Detalhada: Planejar e monitorar o cronograma de manutenções preventivas e corretivas da frota, controlar indicadores operacionais e apoiar a gestão de suprimentos.
Escolaridade: Ensino superior completo em Administração, Logística, Engenharia ou áreas correlatas.
Experiência: Mínimo 2 anos.
Conhecimentos/Habilidades necessários: Excel avançado, conhecimento em sistemas ERP; conhecimento em controle de estoque e inventários e conhecimento em gestão de frotas.
Conhecimentos/Habilidades desejáveis: Conhecimento em Power BI ou ferramentas de análise de dados.
Competências humanas Gesto.Com: Relacionamento, Comunicação, Atitude e Saúde e Segurança.
Competências funcionais Gesto.Com: Autogestão, Adaptação à Mudança e Domínio Técnico.
Outros: Organização e Planejamento, Capacidade Analítica, Proatividade, Senso de Urgência,
Atenção aos Detalhes e Conformidade Processual.
Complexidade do cargo
☐ Alta ☒ Média ☐ Baixa
Gestão
☒ Gere a si próprio e suas entregas ☐ Gere equipe direta ☐ Gere área
Acesso a dados confidenciais
☐ Nunca/Raro ☒ Sempre/Frequente ☐ Eventual
Responsabilidades
☒ Por suas entregas ☐ Por equipe ☐ Por orçamento
`;

const parsed = parsePositionDescriptionText(ddRh241Text);

assert.strictEqual(parsed.name, 'Analista de Logística, Suprimentos e Frotas Pleno');
assert.strictEqual(parsed.indexador, 'DD.RH.241');
assert.strictEqual(parsed.revision, '00');
assert.strictEqual(parsed.documentDate, '2026-06-18');
assert.strictEqual(parsed.managerPosition, 'Coordenador de Logística e Suprimentos');
assert.strictEqual(parsed.framing, 'Administrativo');
assert.strictEqual(parsed.areaSector, 'Logística');
assert.strictEqual(parsed.cbo, '2527-15');
assert(parsed.summary.startsWith('Responsável por otimizar a performance operacional e financeira da frota'));
assert(parsed.detailedDescription.startsWith('Planejar e monitorar o cronograma de manutenções preventivas e corretivas da frota'));
assert.strictEqual(parsed.schooling, 'Ensino superior completo em Administração, Logística, Engenharia ou áreas correlatas.');
assert.strictEqual(parsed.experience, 'Mínimo 2 anos.');
assert.strictEqual(parsed.necessaryKnowledge, 'Excel avançado, conhecimento em sistemas ERP; conhecimento em controle de estoque e inventários e conhecimento em gestão de frotas.');
assert.strictEqual(parsed.desiredKnowledge, 'Conhecimento em Power BI ou ferramentas de análise de dados.');
assert.strictEqual(parsed.humanCompetencies, 'Relacionamento, Comunicação, Atitude e Saúde e Segurança.');
assert.strictEqual(parsed.functionalCompetencies, 'Autogestão, Adaptação à Mudança e Domínio Técnico.');
assert.strictEqual(parsed.otherCompetencies, 'Organização e Planejamento, Capacidade Analítica, Proatividade, Senso de Urgência,\nAtenção aos Detalhes e Conformidade Processual.');
assert.strictEqual(parsed.complexity, 'Média');
assert.strictEqual(parsed.managementScope, 'Gere a si próprio e suas entregas');
assert.strictEqual(parsed.confidentialDataAccess, 'Sempre/Frequente');
assert.strictEqual(parsed.responsibilities, 'Por suas entregas');
assert.notStrictEqual(parsed.name, 'Alta Média Baixa');

console.log('position-document-parser-dd-rh-241 ok');
