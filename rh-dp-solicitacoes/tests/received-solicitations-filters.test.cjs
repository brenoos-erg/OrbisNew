require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
require("tsconfig-paths/register");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  applyReceivedInMemoryFilters,
  buildListAndCountArgs,
  buildReceivedFilterText,
  buildReceivedResponsibleFilterText,
  buildWhereFromSearchParams,
  getAdvancedTextFilters,
  hasReceivedInMemoryFilters,
} = require("../src/lib/receivedSolicitationsQuery");

const receivedRouteSource = fs.readFileSync(
  "src/app/api/solicitacoes/recebidas/route.ts",
  "utf8",
);
const receivedPageSource = fs.readFileSync(
  "src/app/dashboard/solicitacoes/recebidas/page.tsx",
  "utf8",
);

function makeParams(entries) {
  return new URLSearchParams(entries);
}

const baseRow = {
  id: "visible-1",
  protocolo: "RQ2026-01348",
  titulo: "Solicitação de teste",
  descricao: "Descrição geral",
  status: "EM_ATENDIMENTO",
  tipoId: "tipo-1",
  departmentId: "dep-rh",
  costCenterId: "cc-490",
  dataAbertura: new Date("2026-05-01T12:00:00Z"),
  dataFechamento: new Date("2026-05-04T18:00:00Z"),
  tipo: { id: "tipo-1", codigo: "RQ.RH.001", nome: "Alteração cadastral" },
  department: {
    id: "dep-rh",
    name: "Recursos Humanos",
    sigla: "RH",
    code: "10",
  },
  costCenter: {
    id: "cc-490",
    description: "Recursos Humanos",
    externalCode: "490",
    code: "RH",
    abbreviation: "RH",
  },
  solicitante: {
    id: "user-1",
    fullName: "Alan Breno Thaina",
    login: "alan.silva",
    email: "alan@example.com",
    registration: "MAT-USER-777",
  },
  assumidaPor: {
    id: "agent-1",
    fullName: "Maria Atendente",
    login: "maria.rh",
    email: "maria.rh@example.com",
  },
  approver: {
    id: "approver-1",
    fullName: "Carlos Aprovador",
    login: "carlos.aprov",
    email: "carlos@example.com",
  },
  payload: {
    matricula: "MAT-PAYLOAD-888",
    formulario: { observacao: "conteúdo especial do payload" },
    centroCusto: "Centro legado textual 490",
  },
  comentarios: [
    {
      texto: "comentário com palavra sigilosa",
      autor: { fullName: "Comentador RH", login: "comentador" },
    },
  ],
  anexos: [
    {
      filename: "laudo-sigiloso.pdf",
      url: "/uploads/laudo-sigiloso.pdf",
      mimeType: "application/pdf",
    },
  ],
  timelines: [
    { status: "EM_ATENDIMENTO", message: "timeline contém acompanhamento" },
  ],
  eventos: [
    {
      tipo: "FINALIZADA_RH",
      createdAt: new Date("2026-05-05T10:00:00Z"),
      actor: {
        id: "fin-1",
        fullName: "Fernanda Finalizadora",
        login: "fernanda.fin",
        email: "fernanda@example.com",
      },
    },
    {
      tipo: "ASSUMIDA",
      createdAt: new Date("2026-05-02T10:00:00Z"),
      actor: {
        id: "agent-1",
        fullName: "Maria Atendente",
        login: "maria.rh",
        email: "maria.rh@example.com",
      },
    },
  ],
  solicitacaoSetores: [{ status: "CONCLUIDO", constaFlag: true }],
};

const otherVisibleRow = {
  ...baseRow,
  id: "visible-2",
  protocolo: "RQ2026-09999",
  solicitante: {
    id: "user-2",
    fullName: "Outro Solicitante",
    login: "outro.login",
    email: "outro@example.com",
  },
  payload: { matricula: "OUTRA-MAT" },
  assumidaPor: {
    id: "agent-2",
    fullName: "Outro Atendente",
    login: "outro.atendente",
    email: "outro.agent@example.com",
  },
  approver: {
    id: "approver-2",
    fullName: "Outro Aprovador",
    login: "outro.aprov",
    email: "outro.aprov@example.com",
  },
  comentarios: [{ texto: "sem o termo procurado" }],
  anexos: [
    {
      filename: "arquivo-normal.pdf",
      url: "/normal.pdf",
      mimeType: "application/pdf",
    },
  ],
  eventos: [
    {
      tipo: "CRIADA",
      createdAt: new Date("2026-05-01T10:00:00Z"),
      actor: { id: "user-2", fullName: "Outro Solicitante" },
    },
  ],
};

const hiddenByPolicyRow = {
  ...baseRow,
  id: "hidden-1",
  protocolo: "RQ2026-77777",
  solicitante: {
    id: "hidden-user",
    fullName: "Alan sem permissão",
    login: "alan.hidden",
    email: "hidden@example.com",
  },
};

function onlyIds(rows) {
  return rows.map((row) => row.id);
}

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ protocolo: "01348" })),
    ),
  ),
  ["visible-1"],
  "1. filtro protocolo deve funcionar por trecho, não apenas prefixo.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ solicitanteNome: "thaina" })),
    ),
  ),
  ["visible-1"],
  "2. filtro solicitanteNome deve buscar por trecho normalizado.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ solicitanteLogin: "ALAN.SIL" })),
    ),
  ),
  ["visible-1"],
  "3. filtro solicitanteLogin deve ser case-insensitive por normalização.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ matricula: "USER-777" })),
    ),
  ),
  ["visible-1"],
  "4. filtro matricula deve funcionar quando o dado vem carregado no solicitante/User.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ matricula: "payload-888" })),
    ),
  ),
  ["visible-1"],
  "5. filtro matricula deve funcionar quando a matrícula está no payload/formulário.",
);

assert.equal(
  buildWhereFromSearchParams(makeParams({ tipoId: "tipo-1" })).tipoId,
  "tipo-1",
  "6. filtro tipoId deve continuar no Prisma.",
);
assert.equal(
  buildWhereFromSearchParams(makeParams({ departmentId: "dep-rh" }))
    .departmentId,
  "dep-rh",
  "7. filtro departmentId deve continuar no Prisma.",
);
assert.equal(
  buildWhereFromSearchParams(makeParams({ costCenterId: "cc-490" }))
    .costCenterId,
  "cc-490",
  "8. filtro costCenterId deve continuar no Prisma.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ responsavel: "maria" })),
    ),
  ),
  ["visible-1"],
  "9. filtro responsavel deve encontrar assumidaPor.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ responsavel: "carlos.aprov" })),
    ),
  ),
  ["visible-1"],
  "10. filtro responsavel deve encontrar approver por login.",
);

const evaluationFallbackRow = {
  ...baseRow,
  id: "visible-evaluation",
  status: "AGUARDANDO_FINALIZACAO_AVALIACAO",
  tipo: {
    id: "RQ_RH_103",
    codigo: "RQ.RH.103",
    nome: "Avaliação do Período de Experiência",
  },
  assumidaPor: null,
  assumidaPorId: null,
  approver: null,
  approverId: null,
};
assert.match(
  buildReceivedResponsibleFilterText(evaluationFallbackRow),
  /RH \/ Coordenadores de Avaliação/,
);
assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [evaluationFallbackRow, otherVisibleRow],
      getAdvancedTextFilters(
        makeParams({ responsavel: "coordenadores de avaliacao" }),
      ),
    ),
  ),
  ["visible-evaluation"],
  "11. filtro responsavel deve encontrar fallback de avaliação.",
);

assert.equal(
  buildWhereFromSearchParams(makeParams({ status: "CONCLUIDA" })).status,
  "CONCLUIDA",
  "12. filtro status deve continuar no Prisma.",
);
assert.deepEqual(
  buildWhereFromSearchParams(makeParams({ situacao: "EM_ATENDIMENTO" })).status
    .in,
  [
    "EM_ATENDIMENTO",
    "AGUARDANDO_AVALIACAO_GESTOR",
    "AGUARDANDO_FINALIZACAO_AVALIACAO",
  ],
  "13. filtro situacao deve preservar estados de atendimento e avaliação.",
);

assert.deepEqual(
  buildWhereFromSearchParams(makeParams({ openedDate: "2026-05-01" }))
    .dataAbertura,
  {
    gte: new Date("2026-05-01T00:00:00"),
    lte: new Date("2026-05-01T23:59:59"),
  },
  "14. filtro data abertura exata deve cobrir o dia inteiro.",
);
assert.equal(
  buildWhereFromSearchParams(
    makeParams({ openedStart: "2026-05-01", openedEnd: "2026-05-31" }),
  ).dataAbertura.gte.toISOString(),
  "2026-05-01T00:00:00.000Z",
  "15. filtro período abertura deve continuar usando intervalo UTC.",
);
assert.deepEqual(
  buildWhereFromSearchParams(makeParams({ closedDate: "2026-05-04" }))
    .dataFechamento,
  {
    gte: new Date("2026-05-04T00:00:00"),
    lte: new Date("2026-05-04T23:59:59"),
  },
  "16. filtro data fechamento exata deve cobrir o dia inteiro.",
);
assert.equal(
  buildWhereFromSearchParams(
    makeParams({ closedStart: "2026-05-01", closedEnd: "2026-05-31" }),
  ).dataFechamento.lte.toISOString(),
  "2026-05-31T23:59:59.999Z",
  "17. filtro período fechamento deve continuar usando intervalo UTC.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ text: "conteudo especial" })),
    ),
  ),
  ["visible-1"],
  "18. filtro texto global deve encontrar conteúdo no payload.",
);
assert.match(
  buildReceivedFilterText(baseRow),
  /comentario com palavra sigilosa/,
);
assert.match(buildReceivedFilterText(baseRow), /laudo-sigiloso/);
assert.match(
  buildReceivedFilterText(baseRow),
  /timeline contem acompanhamento/,
);
assert.match(buildReceivedFilterText(baseRow), /fernanda finalizadora/);
assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(makeParams({ text: "sigilosa" })),
    ),
  ),
  ["visible-1"],
  "19. filtro texto global deve encontrar comentário/anexo/evento/timeline.",
);

assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      [baseRow, otherVisibleRow],
      getAdvancedTextFilters(
        makeParams({
          solicitanteNome: "alan",
          responsavel: "maria",
          text: "payload",
        }),
      ),
    ),
  ),
  ["visible-1"],
  "20. combinação de filtros textuais deve funcionar por interseção.",
);

const policyLimitedCandidates = [baseRow, otherVisibleRow];
assert.deepEqual(
  onlyIds(
    applyReceivedInMemoryFilters(
      policyLimitedCandidates,
      getAdvancedTextFilters(makeParams({ solicitanteNome: "alan" })),
    ),
  ),
  ["visible-1"],
  "21. filtros em memória devem atuar somente nos candidatos já limitados por permissão.",
);
assert.notDeepEqual(
  policyLimitedCandidates.map((row) => row.id),
  [hiddenByPolicyRow.id],
  "21. fixture oculta não deve ser usada como candidata permitida.",
);

const pageArgs = buildListAndCountArgs(
  {},
  {
    skip: 10,
    pageSize: 10,
    orderBy: [{ dataAbertura: "desc" }],
    includeGlobalSearchData: true,
  },
);
assert.equal(
  pageArgs.findManyArgs.skip,
  0,
  "22. filtros em memória devem buscar candidatos desde o início antes de paginar.",
);
assert.equal(
  "take" in pageArgs.findManyArgs,
  false,
  "22. filtros em memória não devem manter limite fixo de 500 candidatos.",
);
assert.equal(
  hasReceivedInMemoryFilters(
    getAdvancedTextFilters(makeParams({ text: "alan" })),
  ),
  true,
  "22. total deve ser calculado após filtros em memória na rota.",
);
assert.match(
  receivedRouteSource,
  /const total = hasInMemoryFilters \? filteredSolicitations\.length : dbTotal/,
  "22. total da API deve ser pós-filtro em memória.",
);
assert.match(
  receivedRouteSource,
  /filteredSolicitations\.slice\(skip, skip \+ pageSize\)/,
  "22. paginação deve ocorrer depois dos filtros em memória.",
);

assert.match(
  receivedPageSource,
  /if \(filters\.solicitanteNome\) params\.set\('solicitanteNome'/,
  "23. exportação Excel deve enviar solicitanteNome.",
);
assert.match(
  receivedPageSource,
  /if \(filters\.solicitanteLogin\) params\.set\('solicitanteLogin'/,
  "23. exportação Excel deve enviar solicitanteLogin.",
);
assert.match(
  receivedPageSource,
  /if \(filters\.matricula\) params\.set\('matricula'/,
  "23. exportação Excel deve enviar matrícula.",
);
assert.match(
  receivedPageSource,
  /if \(filters\.responsavel\) params\.set\('responsavel'/,
  "23. exportação Excel deve enviar responsável.",
);
assert.match(
  receivedPageSource,
  /if \(filters\.text\) params\.set\('text'/,
  "23. exportação Excel deve enviar texto global.",
);
assert.match(
  receivedRouteSource,
  /getAdvancedTextFilters\(searchParams\)/,
  "23. exportação usa a mesma API e os mesmos filtros avançados da listagem.",
);

assert.doesNotMatch(
  receivedRouteSource,
  /mode:\s*['"]insensitive['"]/,
  "Rota recebidas não deve usar mode insensitive incompatível com MySQL.",
);
assert.doesNotMatch(
  receivedRouteSource,
  /fullName:\s*\{\s*contains:\s*responsavel\s*\}/,
  "Responsável deve ser filtrado em memória, sem contains no Prisma.",
);

console.log("✅ received-solicitations-filters.test.cjs passed");
