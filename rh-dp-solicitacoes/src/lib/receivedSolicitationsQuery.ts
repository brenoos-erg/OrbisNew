import { Prisma } from "@prisma/client";
import { EXPERIENCE_EVALUATION_FINALIZATION_STATUS } from "./experienceEvaluation.constants";
import {
  buildUtcDateRangeFilter,
  normalizeFilterText,
} from "./solicitationFilters";
import { resolvePrimaryResponsibleForList } from "./solicitationResponsibility";
import {
  isValidSolicitationStatus,
  onlyValidSolicitationStatuses,
} from "./solicitationStatuses";

export type ReceivedAdvancedTextFilters = {
  protocolo: string;
  solicitanteNome: string;
  solicitanteLogin: string;
  matricula: string;
  responsavel: string;
  text: string;
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function flattenSearchableText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  )
    return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value
      .map((item) => flattenSearchableText(item))
      .filter(Boolean)
      .join(" ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => flattenSearchableText(item))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function normalizeFilterTerm(value: string | null): string {
  return normalizeSearchText(normalizeFilterText(value));
}

export function matchesNormalizedTerm(value: unknown, term: string): boolean {
  if (!term) return true;
  return normalizeSearchText(flattenSearchableText(value)).includes(term);
}

export function hasReceivedInMemoryFilters(
  filters: ReceivedAdvancedTextFilters,
): boolean {
  return Object.values(filters).some((value) => value.length > 0);
}

export function getAdvancedTextFilters(
  searchParams: URLSearchParams,
): ReceivedAdvancedTextFilters {
  return {
    protocolo: normalizeFilterTerm(searchParams.get("protocolo")),
    solicitanteNome: normalizeFilterTerm(searchParams.get("solicitanteNome")),
    solicitanteLogin: normalizeFilterTerm(searchParams.get("solicitanteLogin")),
    matricula: normalizeFilterTerm(searchParams.get("matricula")),
    responsavel: normalizeFilterTerm(searchParams.get("responsavel")),
    text: normalizeFilterTerm(searchParams.get("text")),
  };
}

function buildUserSearchText(user: unknown): string {
  return flattenSearchableText(user);
}

function buildSolicitanteMatriculaText(
  solicitation: Record<string, unknown>,
): string {
  const solicitante = (solicitation.solicitante ?? {}) as Record<
    string,
    unknown
  >;
  const payload = (solicitation.payload ?? {}) as Record<string, unknown>;

  return flattenSearchableText([
    solicitante.matricula,
    solicitante.registration,
    solicitante.employeeCode,
    solicitante.employeeId,
    solicitante.codigoFuncionario,
    solicitante.codFuncionario,
    solicitante.chapa,
    payload.matricula,
    payload.registration,
    payload.employeeCode,
    payload.employeeId,
    payload.codigoFuncionario,
    payload.codFuncionario,
    payload.chapa,
    payload.solicitanteMatricula,
    payload.matriculaSolicitante,
    payload.dadosSolicitante,
    payload.colaborador,
    payload.funcionario,
    payload.formulario,
    payload.form,
    payload.dynamicForm,
    payload.answers,
  ]);
}

export function buildReceivedResponsibleFilterText(
  solicitation: Record<string, unknown>,
): string {
  const eventos = Array.isArray(solicitation.eventos)
    ? solicitation.eventos
    : [];
  const finalizadorEvent = eventos.find((event) => {
    const tipo = (event as Record<string, unknown>)?.tipo;
    return (
      typeof tipo === "string" &&
      [
        "FINALIZADA",
        "FINALIZADA_RH",
        "FINALIZADA_DP",
        "FINALIZADA_TI",
      ].includes(tipo)
    );
  }) as Record<string, unknown> | undefined;

  const responsible = resolvePrimaryResponsibleForList({
    tipo: solicitation.tipo as Parameters<
      typeof resolvePrimaryResponsibleForList
    >[0]["tipo"],
    assumidaPor: solicitation.assumidaPor as Parameters<
      typeof resolvePrimaryResponsibleForList
    >[0]["assumidaPor"],
    assumidaPorId: solicitation.assumidaPorId as string | null | undefined,
    approver: solicitation.approver as Parameters<
      typeof resolvePrimaryResponsibleForList
    >[0]["approver"],
    approverId: solicitation.approverId as string | null | undefined,
    status: solicitation.status as string | null | undefined,
  });

  const fallbackExperienceFinalization =
    solicitation.status === EXPERIENCE_EVALUATION_FINALIZATION_STATUS &&
    responsible.responsavel?.fullName === "RH / Coordenadores de Avaliação"
      ? "RH / Coordenadores de Avaliação"
      : "";

  return flattenSearchableText([
    solicitation.assumidaPor,
    solicitation.approver,
    responsible.responsavel,
    finalizadorEvent?.actor,
    fallbackExperienceFinalization,
  ]);
}

export function buildReceivedFilterText(
  solicitation: Record<string, unknown>,
): string {
  const parts = [
    flattenSearchableText(solicitation.protocolo),
    flattenSearchableText(solicitation.titulo),
    flattenSearchableText(solicitation.descricao),
    flattenSearchableText(solicitation.status),
    flattenSearchableText(solicitation.tipo),
    flattenSearchableText(solicitation.department),
    flattenSearchableText(solicitation.costCenter),
    buildUserSearchText(solicitation.solicitante),
    buildReceivedResponsibleFilterText(solicitation),
    flattenSearchableText(solicitation.comentarios),
    flattenSearchableText(solicitation.anexos),
    flattenSearchableText(solicitation.eventos),
    flattenSearchableText(solicitation.timelines),
    flattenSearchableText(solicitation.solicitacaoSetores),
    flattenSearchableText(solicitation.payload),
    flattenSearchableText(solicitation.approvalComment),
  ];

  return normalizeSearchText(parts.filter(Boolean).join(" "));
}

export function buildSolicitationSearchText(
  solicitation: Record<string, unknown>,
): string {
  return buildReceivedFilterText(solicitation);
}

export function applyReceivedInMemoryFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: ReceivedAdvancedTextFilters,
): T[] {
  if (!hasReceivedInMemoryFilters(filters)) return rows;

  return rows.filter((solicitation) => {
    const solicitante = (solicitation.solicitante ?? {}) as Record<
      string,
      unknown
    >;

    if (
      filters.protocolo &&
      !matchesNormalizedTerm(solicitation.protocolo, filters.protocolo)
    )
      return false;
    if (
      filters.solicitanteNome &&
      !matchesNormalizedTerm(solicitante.fullName, filters.solicitanteNome)
    )
      return false;
    if (
      filters.solicitanteLogin &&
      !matchesNormalizedTerm(solicitante.login, filters.solicitanteLogin)
    )
      return false;
    if (
      filters.matricula &&
      !matchesNormalizedTerm(
        buildSolicitanteMatriculaText(solicitation),
        filters.matricula,
      )
    )
      return false;
    if (
      filters.responsavel &&
      !matchesNormalizedTerm(
        buildReceivedResponsibleFilterText(solicitation),
        filters.responsavel,
      )
    )
      return false;
    if (
      filters.text &&
      !buildReceivedFilterText(solicitation).includes(filters.text)
    )
      return false;

    return true;
  });
}

export function applyReceivedSectorVisibilityFilter<T extends Record<string, unknown>>(
  rows: T[],
  scope: { normalizedSectorNames: string[]; departmentIds: string[]; costCenterIds: string[] },
): T[] {
  const names = scope.normalizedSectorNames.filter(Boolean)
  if (names.length === 0 && scope.departmentIds.length === 0 && scope.costCenterIds.length === 0) return rows

  return rows.filter((solicitation) => {
    const departmentId = String(solicitation.departmentId ?? '')
    const costCenterId = String(solicitation.costCenterId ?? '')
    if (departmentId && scope.departmentIds.includes(departmentId)) return true
    if (costCenterId && scope.costCenterIds.includes(costCenterId)) return true

    const searchable = buildReceivedFilterText(solicitation)
    return names.some((name) => searchable.includes(name))
  })
}

export function buildWhereFromSearchParams(searchParams: URLSearchParams) {
  const where: Prisma.SolicitationWhereInput = {};

  const openedDate = searchParams.get("openedDate");
  const dateStart =
    searchParams.get("dateStart") ?? searchParams.get("openedStart");
  const dateEnd = searchParams.get("dateEnd") ?? searchParams.get("openedEnd");
  const closedDate = searchParams.get("closedDate");
  const closedStart = searchParams.get("closedStart");
  const closedEnd = searchParams.get("closedEnd");
  const centerId = searchParams.get("centerId");
  const costCenterId = searchParams.get("costCenterId") ?? centerId;
  const departmentId = searchParams.get("departmentId");
  const tipoId = searchParams.get("tipoId");
  const status = normalizeFilterText(searchParams.get("status"));
  const situacao = normalizeFilterText(searchParams.get("situacao"));

  if (openedDate) {
    where.dataAbertura = {
      gte: new Date(`${openedDate}T00:00:00`),
      lte: new Date(`${openedDate}T23:59:59`),
    };
  } else {
    const openedRange = buildUtcDateRangeFilter({
      start: dateStart,
      end: dateEnd,
    });
    if (openedRange) where.dataAbertura = openedRange;
  }

  if (departmentId) where.departmentId = departmentId;
  if (costCenterId) where.costCenterId = costCenterId;
  if (tipoId) where.tipoId = tipoId;

  if (closedDate) {
    where.dataFechamento = {
      gte: new Date(`${closedDate}T00:00:00`),
      lte: new Date(`${closedDate}T23:59:59`),
    };
  } else {
    const closedRange = buildUtcDateRangeFilter({
      start: closedStart,
      end: closedEnd,
    });
    if (closedRange) where.dataFechamento = closedRange;
  }

  if (isValidSolicitationStatus(status)) {
    where.status = status;
  } else if (situacao) {
    const statusBySituacao: Record<string, string[]> = {
      PENDENTE: ["ABERTA", "AGUARDANDO_APROVACAO", "AGUARDANDO_TERMO"],
      EM_ATENDIMENTO: [
        "EM_ATENDIMENTO",
        "AGUARDANDO_AVALIACAO_GESTOR",
        "AGUARDANDO_FINALIZACAO_AVALIACAO",
      ],
      FINALIZADO: ["CONCLUIDA"],
      REJEITADO: ["CANCELADA"],
    };
    if (statusBySituacao[situacao]) {
      const validStatuses = onlyValidSolicitationStatuses(
        statusBySituacao[situacao],
      );
      if (validStatuses.length > 0) where.status = { in: validStatuses };
    }
  }

  return where;
}

export function getGlobalTextSearch(searchParams: URLSearchParams): string {
  return getAdvancedTextFilters(searchParams).text;
}

export function buildListAndCountArgs(
  where: Prisma.SolicitationWhereInput,
  {
    skip,
    pageSize,
    orderBy,
    includeGlobalSearchData,
  }: {
    skip: number;
    pageSize: number;
    orderBy: Prisma.SolicitationOrderByWithRelationInput[];
    includeGlobalSearchData?: boolean;
  },
) {
  const paginationArgs: { skip: number; take?: number } =
    includeGlobalSearchData ? { skip: 0 } : { skip, take: pageSize };

  return {
    findManyArgs: {
      where,
      ...paginationArgs,
      orderBy,
      include: {
        tipo: { select: { id: true, codigo: true, nome: true } },
        department: {
          select: { id: true, name: true, sigla: true, code: true },
        },
        costCenter: {
          select: {
            id: true,
            description: true,
            externalCode: true,
            code: true,
            abbreviation: true,
            observations: true,
            area: true,
            groupName: true,
          },
        },
        approver: {
          select: { id: true, fullName: true, login: true, email: true },
        },
        assumidaPor: {
          select: { id: true, fullName: true, login: true, email: true },
        },
        solicitante: {
          select: {
            id: true,
            fullName: true,
            login: true,
            email: true,
            costCenterId: true,
            departmentId: true,
            costCenter: {
              select: {
                description: true,
                externalCode: true,
                code: true,
                abbreviation: true,
              },
            },
            department: { select: { name: true, sigla: true, code: true } },
          },
        },
        solicitacaoSetores: { select: { status: true, constaFlag: true } },
        comentarios: {
          select: {
            texto: true,
            autor: { select: { fullName: true, login: true, email: true } },
          },
        },
        anexos: { select: { filename: true, url: true, mimeType: true } },
        timelines: { select: { status: true, message: true, createdAt: true } },
        eventos: {
          orderBy: { createdAt: "desc" as const },
          include: {
            actor: {
              select: { id: true, fullName: true, login: true, email: true },
            },
          },
        },
      },
    } satisfies Prisma.SolicitationFindManyArgs,
    countArgs: { where } satisfies Prisma.SolicitationCountArgs,
  };
}
