const assert = require("assert");
const fs = require("fs");

const novo = fs.readFileSync(
  "src/app/dashboard/rh/cargos/novo/page.tsx",
  "utf8",
);
const edit = fs.readFileSync(
  "src/app/dashboard/rh/cargos/[id]/page.tsx",
  "utf8",
);
const list = fs.readFileSync("src/app/dashboard/rh/cargos/page.tsx", "utf8");
const modal = fs.readFileSync(
  "src/app/dashboard/rh/cargos/CargoFormModal.tsx",
  "utf8",
);
const rq063 = fs.readFileSync(
  "src/app/dashboard/solicitacoes/enviadas/nova/page.tsx",
  "utf8",
);
const route = fs.readFileSync("src/app/api/positions/route.ts", "utf8");

assert(
  novo.includes("CargoFormModal"),
  "/cargos/novo deve usar o fluxo compartilhado do CargoFormModal",
);
assert(
  novo.includes("Documento oficial") ||
    modal.includes("Documento oficial do cargo"),
  "/cargos/novo deve mostrar seção de documento oficial",
);
assert(
  modal.includes("Importar documento do cargo"),
  "/cargos/novo deve mostrar Importar documento do cargo",
);
assert(
  modal.includes('accept=".docx,.pdf,.doc"'),
  "upload deve aceitar .docx, .pdf e .doc",
);
assert(
  modal.includes("/api/positions/document-preview"),
  "/cargos/novo deve chamar /api/positions/document-preview",
);
assert(
  modal.includes("Documento lido. Revise os campos extraídos antes de salvar."),
  "prévia deve orientar revisão antes de salvar",
);
assert(
  modal.includes(
    "const url = row?.id ? `/api/positions/${row.id}` : '/api/positions'",
  ),
  "novo deve salvar via /api/positions e edição via /api/positions/[id]",
);
assert(
  modal.includes("tempFileToken: pendingDocument?.tempFileToken"),
  "payload deve enviar tempFileToken ao salvar",
);
assert(
  !novo.includes("/api/configuracoes/cargos"),
  "/cargos/novo não pode usar endpoint legado",
);
assert(
  !edit.includes("/api/configuracoes/cargos"),
  "/cargos/[id] não pode usar endpoint legado",
);
assert(
  edit.includes("fetch(`/api/positions/${cargoId}`)"),
  "edição deve carregar via /api/positions/[id]",
);
assert(
  modal.includes("Substituir documento"),
  "edição deve permitir substituir documento vigente",
);
assert(
  modal.includes("Histórico de documentos do cargo"),
  "edição deve mostrar histórico de documentos",
);
assert(
  modal.includes("/api/positions/${row.id}/documents/${doc.id}/download"),
  "histórico deve baixar pela rota protegida",
);
assert(
  list.includes('href="/dashboard/rh/cargos/novo"'),
  "listagem deve apontar novo cargo para a rota RH",
);
assert(
  /cargo\.latestDocument\s*\?\s*["']Anexado["']/.test(list),
  "listagem deve exibir Documento Anexado quando houver documento",
);
assert(
  !list.includes("CargoFormTrigger"),
  "listagem não deve manter uma segunda experiência modal concorrente",
);
assert(
  !rq063.includes("filteredPositionsForRq063"),
  "RQ_063 não deve puxar cargos cadastrados como dependência",
);

assert(
  list.includes(
    "latestDocument?: { id: string; indexador?: string | null } | null",
  ),
  "type Cargo deve tipar latestDocument com indexador",
);
assert(
  list.includes("function getCargoIndexador") &&
    /cargo\.indexador\s*\|\|\s*cargo\.latestDocument\?\.indexador\s*\|\|\s*["']—["']/.test(
      list,
    ),
  "listagem deve exibir cargo.indexador ou latestDocument.indexador",
);
assert(
  list.indexOf(">Código</th>") !== -1 &&
    list.indexOf(">Código</th>") < list.indexOf(">Nome</th>"),
  "listagem deve exibir coluna Código antes de Nome",
);
const cargoRowMarkup = list.slice(list.indexOf("cargos.map((cargo)"));
assert(
  cargoRowMarkup.indexOf("{getCargoIndexador(cargo)}") !== -1 &&
    cargoRowMarkup.indexOf("{getCargoIndexador(cargo)}") <
      cargoRowMarkup.indexOf("{cargo.name}"),
  "linha deve exibir código antes do nome",
);
assert(
  list.includes("código/indexador"),
  "busca deve indicar suporte a código/indexador",
);
assert(list.includes("Exibir"), "listagem deve mostrar botão Exibir");
assert(
  list.includes("?mode=view"),
  "botão Exibir deve abrir rota em modo view",
);
assert(list.includes("Editar"), "listagem deve manter botão Editar");
assert(list.includes("Excluir"), "listagem deve manter botão Excluir");
assert(
  modal.includes("readOnly?: boolean"),
  "CargoFormModal deve possuir prop readOnly",
);
assert(
  modal.includes("readOnly ? 'Exibir cargo'"),
  "CargoFormModal deve mostrar Exibir cargo quando readOnly",
);
assert(
  modal.includes("!readOnly && (") &&
    modal.includes("{saving ? 'Salvando...' : 'Salvar'}"),
  "CargoFormModal deve esconder Salvar quando readOnly",
);
assert(
  modal.includes("if (readOnly || !file) return") &&
    modal.includes("!readOnly && (") &&
    modal.includes("Importar documento do cargo"),
  "CargoFormModal não deve permitir upload quando readOnly",
);
assert(
  modal.includes("Baixar documento"),
  "CargoFormModal deve manter Baixar documento",
);

assert(list.includes("Excluir"), "listagem deve mostrar botão Excluir");
assert(
  list.includes("fetch(`/api/positions/${cargo.id}`,") &&
    list.includes('method: "DELETE"'),
  "listagem deve usar DELETE /api/positions/[id]",
);
assert(
  list.includes("Cargo inativado porque possui vínculos.") &&
    list.includes("Cargo excluído com sucesso."),
  "listagem deve avisar se inativou ou excluiu",
);
assert(
  modal.includes("Excluir cargo"),
  "modal deve mostrar botão Excluir cargo na edição",
);
assert(
  modal.includes("fetch(`/api/positions/${row.id}`,") &&
    modal.includes("method: 'DELETE'"),
  "modal deve usar DELETE /api/positions/[id]",
);
assert(modal.includes("sticky bottom-0"), "modal deve ter rodapé sticky");
for (const section of [
  "Identificação do documento",
  "Dados do cargo",
  "Descrição e atividades",
  "Formação e requisitos",
  "Competências e responsabilidades",
  "Local de trabalho",
]) {
  assert(modal.includes(section), `modal deve exibir seção ${section}`);
}
assert(
  list.includes("StatusBadge") && list.includes("DocumentBadge"),
  "listagem deve usar badges de status e documento",
);
assert(
  route.includes("{ name: { contains: q } }"),
  "GET /api/positions deve buscar por name",
);
assert(
  route.includes("{ indexador: { contains: q } }"),
  "GET /api/positions deve buscar por indexador do cargo",
);
assert(
  route.includes("{ areaSector: { contains: q } }"),
  "GET /api/positions deve buscar por areaSector",
);
assert(
  route.includes("{ cbo: { contains: q } }"),
  "GET /api/positions deve buscar por cbo",
);
assert(
  /documents:\s*{\s*some:\s*{\s*indexador:\s*{\s*contains:\s*q\s*}/.test(
    route,
  ) && route.includes("isCurrent: true"),
  "GET /api/positions deve buscar por indexador do documento atual/latest",
);

assert(
  rq063.includes("Informe o cargo solicitado"),
  "RQ_063 deve aceitar cargo digitado manualmente",
);

console.log("position-cargos-route-flow-static ok");
