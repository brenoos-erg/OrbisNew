process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs', moduleResolution: 'node' });
require('ts-node/register');
require('tsconfig-paths/register');
const assert = require('assert');
const {
  parseSolicitationListFilters,
  buildBaseWhereFromFilters,
  buildSortFromFilters,
  buildPaginationFromFilters,
  applyInMemorySearchFilter,
  applyResponsibleTextFilter,
} = require('../src/lib/solicitationListFilters');
const { buildSolicitationSearchIndexText, normalizeSolicitationSearchText } = require('../src/lib/solicitationSearchIndex');

const base = {
  id: 'old-1',
  protocolo: 'RQ2026-01411',
  titulo: 'Solicitação antiga',
  descricao: 'Troca de notebook',
  status: 'ABERTA',
  tipo: { codigo: 'RQ.RH.063', nome: 'Solicitação de Pessoal' },
  solicitante: { fullName: 'Ana Paula', login: 'apaula', email: 'ana@example.com' },
  assumidaPor: { fullName: 'Carlos Atendente', login: 'catendente' },
  approver: { fullName: 'Bruna Aprovadora' },
  costCenter: { description: 'Engenharia Centro', externalCode: 'CC-100', abbreviation: 'ENG' },
  department: { name: 'Recursos Humanos', sigla: 'RH' },
  payload: {
    colaborador: { nome: 'Breno Vinícius', matricula: 'CHAPA-9988' },
    cargoSnapshot: { name: 'Analista de Segurança do Trabalho', cbo: '351605' },
    formulario: { observacao: 'precisa de acesso ao SGI' },
  },
  comentarios: [{ texto: 'Comentário com palavra confidencial' }],
  anexos: [{ filename: 'documento-breno.pdf' }],
  eventos: [{ tipo: 'FINALIZADA', actor: { fullName: 'Fernanda Finalizadora' } }],
  timelines: [{ message: 'Encaminhado para RH' }],
};

const params = new URLSearchParams('text=Breno%20Vinicius&page=2&pageSize=25&sortBy=protocolo&sortDir=asc&status=ABERTA&openedStart=2026-01-01&openedEnd=2026-12-31');
const filters = parseSolicitationListFilters(params);
assert.equal(filters.q, 'Breno Vinicius', 'aliases legados text/protocolo/solicitante/matricula alimentam q');
assert.deepEqual(buildPaginationFromFilters(filters), { page: 2, pageSize: 25, skip: 25, take: 25 });
assert.deepEqual(buildSortFromFilters(filters), [{ protocolo: 'asc' }], 'sortBy/sortDir respeitado');
assert.equal(buildBaseWhereFromFilters(filters).status, 'ABERTA', 'status direto prevalece');

assert.equal(normalizeSolicitationSearchText('Breno Vinícius'), 'breno vinicius', 'busca ignora acento/caixa');
const indexed = buildSolicitationSearchIndexText(base);
for (const term of ['rq2026-01411', 'breno vinicius', 'chapa-9988', 'engenharia centro', 'analista de seguranca', 'confidencial', 'documento-breno.pdf']) {
  assert(indexed.includes(term), `índice deve conter ${term}`);
}

assert.equal(applyInMemorySearchFilter([base], 'RQ2026-01411').length, 1, 'busca global encontra protocolo exato antigo no texto');
assert.equal(applyInMemorySearchFilter([base], 'Breno Vinicius').length, 1, 'busca global encontra nome no payload');
assert.equal(applyInMemorySearchFilter([base], 'CHAPA-9988').length, 1, 'busca global encontra matrícula/chapa');
assert.equal(applyInMemorySearchFilter([base], 'Engenharia Centro').length, 1, 'busca global encontra centro de custo');
assert.equal(applyInMemorySearchFilter([base], 'Analista de Segurança').length, 1, 'busca global encontra cargoSnapshot');
assert.equal(applyInMemorySearchFilter([base], 'confidencial').length, 1, 'busca global encontra comentário');
assert.equal(applyInMemorySearchFilter([base], 'documento-breno.pdf').length, 1, 'busca global encontra anexo');
assert.equal(applyResponsibleTextFilter([base], 'Carlos').length, 1, 'responsável encontra assumidaPor');
assert.equal(applyResponsibleTextFilter([base], 'Breno').length, 0, 'responsável não funciona como busca global duplicada');

console.log('solicitation-list-filters-behavior ok');
