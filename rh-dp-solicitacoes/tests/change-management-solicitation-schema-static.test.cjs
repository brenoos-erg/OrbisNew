const assert = require('assert');
const { seed, assertIncludesAll } = require('./change-management-test-utils.cjs');
const source = seed();
assert.match(source, /where:\s*\{ id: 'RQ_QUA_148' \}/, 'tipo Gestão de Mudanças deve existir sem duplicar o cadastro');
assertIncludesAll(source, ['RQ.QUA.148', 'Gestão de Mudanças', 'classificacaoMudanca', 'prioridadeMudanca', 'tiposMudanca', 'areasImpactadas', 'tiposImpactosRiscos', 'documentosImpactadosTipos', 'recursosHumanos', 'recursosMateriais', 'recursosFinanceiros', 'recursosTecnologicos', 'planoComunicacao', 'planoTreinamentos', 'planoAcaoMudanca', 'eficaciaResultadoFinal'], 'schema RQ.QUA.148');
assertIncludesAll(source, ['Permanente', 'Temporária', 'Emergencial', 'Baixa', 'Média', 'Alta', 'Crítica', 'Sigilosa', 'Não Sigilosa'], 'classificação/prioridade/tipo');
assertIncludesAll(source, ['Técnica', 'Processos', 'Materiais', 'Projetos e Construção', 'Ambiente de Trabalho', 'Equipamentos e/ou Instalações', 'Procedimentos Operacionais', 'Matérias-primas e Insumos Diversos', 'Infraestrutura', 'Tecnológica', 'Organizacional', 'Requisito Legal', 'Cliente / Contrato', 'Outras'], 'tipos da mudança');
console.log('change management solicitation schema static ok');
