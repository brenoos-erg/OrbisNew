const assert = require('assert');
const { seed, assertIncludesAll } = require('./change-management-test-utils.cjs');
const source = seed();
assertIncludesAll(source, ['areaSolicitante', 'Área Solicitante', 'gestorArea', 'Gestor da Área', 'qualidadeSigAnalise', 'Qualidade / SIG', 'gerenteGeralDiretoria', 'Gerente Geral / Diretoria', 'qualidadeEficaciaEncerramento', 'Verifica eficácia e encerra'], 'fluxo RQ.QUA.148');
assertIncludesAll(source, ['AGUARDANDO_APROVACAO_GESTOR', 'DEVOLVIDA_PARA_AJUSTES', 'AGUARDANDO_ANALISE_QUALIDADE', 'AGUARDANDO_APROVACAO_DIRETORIA', 'APROVADA_PARA_IMPLEMENTACAO', 'AGUARDANDO_VERIFICACAO_EFICACIA', 'ENCERRADA', 'REPROVADA'], 'status RQ.QUA.148');
console.log('change management flow static ok');
