export const dynamic = "force-dynamic";
export const revalidate = 0;

// rh-dp-solicitacoes/src/app/api/solicitacoes/recebidas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/auth";
import { formatCostCenterLabel } from "@/lib/costCenter";
import {
  buildSensitiveHiringVisibilityWhere,
  getUserDepartmentIds,
} from "@/lib/sensitiveHiringRequests";
import {
  buildReceivedWhereByPolicy,
  canViewSolicitation,
  resolveUserAccessContext,
} from "@/lib/solicitationAccessPolicy";
import {
  applyReceivedInMemoryFilters,
  applyReceivedSectorVisibilityFilter,
  buildListAndCountArgs,
  buildWhereFromSearchParams,
  getAdvancedTextFilters,
  hasReceivedInMemoryFilters,
} from "@/lib/receivedSolicitationsQuery";
import { resolvePrimaryResponsibleForList } from "@/lib/solicitationResponsibility";
import {
  isLinkedAdmissionFromSharedHiringFlow,
  isSolicitacaoPessoalSharedFlowRecord,
} from "@/lib/solicitationVisibility";

type ProtocolFilterDiagnostic =
  | { status: "not_checked" }
  | { status: "not_visible_or_not_found"; message: string }
  | {
      status: "visible_type_mismatch";
      protocolo: string;
      selectedTipoId: string;
      foundTipo: { id: string; codigo: string | null; nome: string };
      solicitationId: string;
    }
  | {
      status: "found_outside_received";
      protocolo: string;
      statusAtual: string;
      etapaAtual: string;
      setorResponsavelAtual: string;
      flowUrl: string;
      message: string;
    }
  | {
      status: "found_without_permission";
      protocolo: string;
      message: string;
    };


const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aguardando atendimento",
  AGUARDANDO_ATENDIMENTO: "Aguardando atendimento",
  EM_ATENDIMENTO: "Em atendimento",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  AGUARDANDO_TERMO: "Aguardando termo",
  AGUARDANDO_AVALIACAO_GESTOR: "Aguardando avaliação gestor",
  AGUARDANDO_FINALIZACAO_AVALIACAO: "Aguardando finalização RH",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada / Recusada",
};

function formatStatusLabel(status?: string | null) {
  if (!status) return "Status não informado";
  return (
    STATUS_LABELS[status] ??
    status
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR")
      .replace(/(^\p{L})|\s+(\p{L})/gu, (match) => match.toLocaleUpperCase("pt-BR"))
  );
}

function resolveCurrentStageLabel(solicitation: {
  status?: string | null;
  approvalStatus?: string | null;
  department?: { name?: string | null } | null;
  costCenter?: Parameters<typeof formatCostCenterLabel>[0] | null;
}) {
  if (
    solicitation.approvalStatus === "PENDENTE" ||
    solicitation.status === "AGUARDANDO_APROVACAO"
  ) {
    return "Aprovadores";
  }

  return (
    solicitation.department?.name ??
    formatCostCenterLabel(solicitation.costCenter, "") ??
    "Atendimento"
  );
}

function resolveCurrentResponsibleSector(solicitation: {
  department?: { name?: string | null } | null;
  costCenter?: Parameters<typeof formatCostCenterLabel>[0] | null;
}) {
  return (
    solicitation.department?.name ??
    formatCostCenterLabel(solicitation.costCenter, "") ??
    "Não informado"
  );
}

function toAndArray(
  andClause: Prisma.SolicitationWhereInput["AND"],
): Prisma.SolicitationWhereInput[] {
  if (!andClause) return [];
  return Array.isArray(andClause) ? andClause : [andClause];
}

function debugReceivedSolicitations(
  message: string,
  details: Record<string, unknown>,
) {
  if (process.env.DEBUG_SOLICITACOES_RECEBIDAS !== "true") return;
  console.debug(`[solicitacoes:recebidas] ${message}`, details);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasDpResponsibleTarget(value: unknown) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return (
    normalized === "DP" ||
    normalized.includes("DEPARTAMENTO PESSOAL") ||
    normalized.includes("DEPTO PESSOAL")
  );
}

function resolveSharedHiringFlowLabel(
  solicitation: {
    tipoId?: string | null;
    status?: string | null;
    payload?: unknown;
    department?: { name?: string | null; sigla?: string | null; code?: string | null } | null;
    costCenter?: { description?: string | null; externalCode?: string | null; code?: string | null; abbreviation?: string | null } | null;
    parentId?: string | null;
    parent?: { tipoId?: string | null; tipo?: { codigo?: string | null; nome?: string | null } | null } | null;
    tipo?: { id?: string | null; codigo?: string | null; nome?: string | null } | null;
  },
  isRhAuthorizedForSharedHiringFlow: boolean,
) {
  if (!isRhAuthorizedForSharedHiringFlow) return null;

  const sharedFlowSolicitation = {
    ...solicitation,
    tipoId: solicitation.tipoId ?? undefined,
    tipo: solicitation.tipo ?? null,
    parentId: solicitation.parentId ?? null,
    parent: solicitation.parent ?? null,
  };
  const isSharedPessoal = isSolicitacaoPessoalSharedFlowRecord(sharedFlowSolicitation);
  const isLinkedAdmission = isLinkedAdmissionFromSharedHiringFlow(sharedFlowSolicitation);
  if (!isSharedPessoal && !isLinkedAdmission) return null;

  const payload = asRecord(solicitation.payload);
  const dpStatus = String(payload.dpStatus ?? "").trim().toUpperCase();
  const hasDpHandoff = Boolean(payload.dpHandoffAt);
  const isDpTarget = [
    solicitation.department?.name,
    solicitation.department?.sigla,
    solicitation.department?.code,
    solicitation.costCenter?.description,
    solicitation.costCenter?.externalCode,
    solicitation.costCenter?.code,
    solicitation.costCenter?.abbreviation,
  ].some(hasDpResponsibleTarget);

  if (dpStatus === "CONCLUIDO" || solicitation.status === "CONCLUIDA") {
    return "Concluído pelo DP — acompanhamento RH";
  }

  if (isLinkedAdmission || dpStatus === "PENDENTE" || hasDpHandoff || isDpTarget) {
    return "Em etapa do DP — acompanhamento RH";
  }

  return null;
}

function resolveOrderBy(
  searchParams: URLSearchParams,
): Prisma.SolicitationOrderByWithRelationInput[] {
  const sortBy = searchParams.get("sortBy") ?? "dataAbertura";
  const sortDir =
    (searchParams.get("sortDir") ?? "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";
  if (sortBy === "protocolo") return [{ protocolo: sortDir }];
  if (sortBy === "nomeSolicitante")
    return [{ solicitante: { fullName: sortDir } }];
  if (sortBy === "departamentoResponsavel")
    return [{ department: { name: sortDir } }];
  if (sortBy === "atendente") return [{ assumidaPor: { fullName: sortDir } }];
  if (sortBy === "status") return [{ status: sortDir }];
  return [{ dataAbertura: sortDir }];
}

function applyReceivedSecurityWhere(
  where: Prisma.SolicitationWhereInput,
  {
    me,
    userAccess,
    receivedVisibilityWhere,
    userDepartmentIdsForSensitive,
  }: {
    me: Awaited<ReturnType<typeof requireActiveUser>>;
    userAccess: Awaited<ReturnType<typeof resolveUserAccessContext>>;
    receivedVisibilityWhere: Prisma.SolicitationWhereInput;
    userDepartmentIdsForSensitive: string[];
  },
) {
  where.AND = [...toAndArray(where.AND), receivedVisibilityWhere];
  where.AND = [
    ...toAndArray(where.AND),
    buildSensitiveHiringVisibilityWhere({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      departmentIds: userDepartmentIdsForSensitive,
      allowedTipoIds: userAccess.allowedTipoIds,
      finalizerTipoIds: userAccess.finalizerTipoIds,
      isExperienceEvaluationCoordinator:
        userAccess.isExperienceEvaluationCoordinator,
      isRhAuthorizedForExperienceEvaluation:
        userAccess.isRhAuthorizedForExperienceEvaluation,
      isRhAuthorizedForSharedHiringFlow:
        userAccess.isRhAuthorizedForSharedHiringFlow,
    }),
  ];

  where.AND = [
    ...toAndArray(where.AND),
    {
      NOT: {
        AND: [
          { requiresApproval: true },
          { approvalStatus: "PENDENTE" },
          {
            OR: [
              { tipo: { id: "RQ_063" } },
              {
                tipo: {
                  codigo: { in: ["RQ.RH.063", "RQ.063", "RQ.RH.001"] },
                },
              },
            ],
          },
        ],
      },
    },
  ];

  return where;
}

async function resolveProtocolFilterDiagnostic({
  protocolo,
  selectedTipoId,
  me,
  userAccess,
  receivedVisibilityWhere,
  userDepartmentIdsForSensitive,
  hasScopeVisibilityPostFilter,
}: {
  protocolo: string;
  selectedTipoId?: string;
  me: Awaited<ReturnType<typeof requireActiveUser>>;
  userAccess: Awaited<ReturnType<typeof resolveUserAccessContext>>;
  receivedVisibilityWhere: Prisma.SolicitationWhereInput;
  userDepartmentIdsForSensitive: string[];
  hasScopeVisibilityPostFilter: boolean;
}): Promise<ProtocolFilterDiagnostic> {
  const normalizedProtocol = protocolo.trim();
  if (!normalizedProtocol) return { status: "not_checked" };

  if (selectedTipoId) {
    const diagnosticWhere = applyReceivedSecurityWhere(
      { protocolo: { contains: normalizedProtocol } },
      { me, userAccess, receivedVisibilityWhere, userDepartmentIdsForSensitive },
    );
    const { findManyArgs } = buildListAndCountArgs(diagnosticWhere, {
      skip: 0,
      pageSize: 25,
      orderBy: [{ dataAbertura: "desc" }],
      includeGlobalSearchData: true,
    });

    const candidates = await prisma.solicitation.findMany(findManyArgs);
    const visibleCandidates = hasScopeVisibilityPostFilter
      ? (applyReceivedSectorVisibilityFilter(
          candidates as unknown as Record<string, unknown>[],
          {
            normalizedSectorNames: userAccess.userSectorNamesNormalized,
            departmentIds: userAccess.userDepartmentIds,
            costCenterIds: userAccess.userCostCenterIds,
            viewerTipoIds: userAccess.viewerTipoIds,
            userSetorKeys: userAccess.userSetorKeys,
            userId: me.id,
            finalizerTipoIds: userAccess.finalizerTipoIds,
            isExperienceEvaluationCoordinator:
              userAccess.isExperienceEvaluationCoordinator,
            isRhAuthorizedForExperienceEvaluation:
              userAccess.isRhAuthorizedForExperienceEvaluation,
            isRhAuthorizedForSharedHiringFlow:
              userAccess.isRhAuthorizedForSharedHiringFlow,
          },
        ) as typeof candidates)
      : candidates;

    const found =
      visibleCandidates.find(
        (item) => item.protocolo?.toUpperCase() === normalizedProtocol.toUpperCase(),
      ) ?? visibleCandidates[0];

    if (found && found.tipoId !== selectedTipoId) {
      return {
        status: "visible_type_mismatch",
        protocolo: found.protocolo ?? normalizedProtocol,
        selectedTipoId,
        foundTipo: {
          id: found.tipo?.id ?? found.tipoId,
          codigo: found.tipo?.codigo ?? null,
          nome: found.tipo?.nome ?? "Tipo não identificado",
        },
        solicitationId: found.id,
      };
    }
  }

  const globalMatch = await prisma.solicitation.findFirst({
    where: {
      OR: [
        { protocolo: normalizedProtocol },
        { protocolo: normalizedProtocol.toUpperCase() },
      ],
    },
    include: {
      tipo: { select: { id: true, codigo: true, nome: true } },
      department: { select: { id: true, name: true, sigla: true, code: true } },
      costCenter: {
        select: {
          id: true,
          code: true,
          externalCode: true,
          abbreviation: true,
          description: true,
        },
      },
      solicitacaoSetores: { select: { setor: true } },
      parent: {
        select: {
          tipoId: true,
          tipo: { select: { codigo: true, nome: true } },
        },
      },
    },
  });

  if (!globalMatch) return { status: "not_checked" };

  const sensitiveVisibilityWhere = buildSensitiveHiringVisibilityWhere({
    userId: me.id,
    userLogin: me.login,
    userEmail: me.email,
    userFullName: me.fullName,
    role: me.role,
    departmentIds: userDepartmentIdsForSensitive,
    allowedTipoIds: userAccess.allowedTipoIds,
    finalizerTipoIds: userAccess.finalizerTipoIds,
    isExperienceEvaluationCoordinator:
      userAccess.isExperienceEvaluationCoordinator,
    isRhAuthorizedForExperienceEvaluation:
      userAccess.isRhAuthorizedForExperienceEvaluation,
    isRhAuthorizedForSharedHiringFlow:
      userAccess.isRhAuthorizedForSharedHiringFlow,
  });
  const passesSensitiveVisibility = Boolean(
    await prisma.solicitation.findFirst({
      where: { AND: [{ id: globalMatch.id }, sensitiveVisibilityWhere] },
      select: { id: true },
    }),
  );
  const canViewGlobalMatch =
    passesSensitiveVisibility && canViewSolicitation(userAccess, globalMatch);

  if (!canViewGlobalMatch) {
    return {
      status: "found_without_permission",
      protocolo: globalMatch.protocolo ?? normalizedProtocol,
      message:
        "O protocolo existe, mas você não possui permissão para visualizar os detalhes.",
    };
  }

  const statusAtual = formatStatusLabel(globalMatch.status);
  const etapaAtual = resolveCurrentStageLabel(globalMatch);
  const setorResponsavelAtual = resolveCurrentResponsibleSector(globalMatch);

  return {
    status: "found_outside_received",
    protocolo: globalMatch.protocolo ?? normalizedProtocol,
    statusAtual,
    etapaAtual,
    setorResponsavelAtual,
    flowUrl: `/dashboard/configuracoes/fluxo-solicitacao?protocolo=${encodeURIComponent(
      globalMatch.protocolo ?? normalizedProtocol,
    )}`,
    message:
      globalMatch.status === "AGUARDANDO_APROVACAO" ||
      globalMatch.approvalStatus === "PENDENTE"
        ? "Este chamado ainda está aguardando aprovação e por isso não aparece em Solicitações Recebidas para atendimento."
        : "Este protocolo existe, mas não está nas suas Solicitações Recebidas no momento.",
  };
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser();
    const { searchParams } = new URL(req.url);
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const pageSize =
      Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10;

    const skip = (page - 1) * pageSize;
    const where = buildWhereFromSearchParams(searchParams);
    const orderBy = resolveOrderBy(searchParams);
    const advancedTextFilters = getAdvancedTextFilters(searchParams);
    let hasInMemoryFilters = hasReceivedInMemoryFilters(advancedTextFilters);

    const userAccess = await resolveUserAccessContext({
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      userFullName: me.fullName,
      role: me.role,
      primaryDepartmentId: me.departmentId,
      primaryDepartment: me.department,
    });
    const receivedVisibilityWhere = buildReceivedWhereByPolicy(userAccess);

    debugReceivedSolicitations("policy-context", {
      userId: me.id,
      userLogin: me.login,
      userEmail: me.email,
      role: me.role,
      status: where.status ?? null,
      tipoId: where.tipoId ?? null,
      finalizerTipoIds: userAccess.finalizerTipoIds,
      allowedTipoIds: userAccess.allowedTipoIds,
      userDepartmentIds: userAccess.userDepartmentIds,
      userSetorKeys: userAccess.userSetorKeys,
      hasSolicitationsModuleAccess: userAccess.hasSolicitationsModuleAccess,
      isExperienceEvaluationCoordinator:
        userAccess.isExperienceEvaluationCoordinator,
      isRhAuthorizedForExperienceEvaluation:
        userAccess.isRhAuthorizedForExperienceEvaluation,
      visibilityWhere: receivedVisibilityWhere,
    });

    const userDepartmentIdsForSensitive = await getUserDepartmentIds(
      me.id,
      me.departmentId,
    );
    applyReceivedSecurityWhere(where, {
      me,
      userAccess,
      receivedVisibilityWhere,
      userDepartmentIdsForSensitive,
    });

    const hasScopeVisibilityPostFilter =
      userAccess.userSectorNamesNormalized.length > 0 ||
      userAccess.userCostCenterIds.length > 0 ||
      userAccess.userDepartmentIds.length > 0;
    if (hasScopeVisibilityPostFilter) hasInMemoryFilters = true;
    const { findManyArgs, countArgs } = buildListAndCountArgs(where, {
      skip,
      pageSize: hasScopeVisibilityPostFilter ? 2000 : pageSize,
      orderBy,
      includeGlobalSearchData: hasInMemoryFilters || hasScopeVisibilityPostFilter,
    });

    const [dbSolicitations, dbTotal] = await Promise.all([
      prisma.solicitation.findMany(findManyArgs),
      prisma.solicitation.count(countArgs),
    ]);

    const scopeFilteredSolicitations = hasScopeVisibilityPostFilter
      ? (applyReceivedSectorVisibilityFilter(
          dbSolicitations as unknown as Record<string, unknown>[],
          {
            normalizedSectorNames: userAccess.userSectorNamesNormalized,
            departmentIds: userAccess.userDepartmentIds,
            costCenterIds: userAccess.userCostCenterIds,
            viewerTipoIds: userAccess.viewerTipoIds,
            userSetorKeys: userAccess.userSetorKeys,
            userId: me.id,
            finalizerTipoIds: userAccess.finalizerTipoIds,
            isExperienceEvaluationCoordinator:
              userAccess.isExperienceEvaluationCoordinator,
            isRhAuthorizedForExperienceEvaluation:
              userAccess.isRhAuthorizedForExperienceEvaluation,
            isRhAuthorizedForSharedHiringFlow:
              userAccess.isRhAuthorizedForSharedHiringFlow,
          },
        ) as typeof dbSolicitations)
      : dbSolicitations;
    const filteredSolicitations = hasInMemoryFilters
      ? (applyReceivedInMemoryFilters(
          scopeFilteredSolicitations as unknown as Record<string, unknown>[],
          advancedTextFilters,
        ) as typeof dbSolicitations)
      : scopeFilteredSolicitations;

    const total = hasInMemoryFilters ? filteredSolicitations.length : dbTotal;
    const pagedSolicitations = hasInMemoryFilters
      ? filteredSolicitations.slice(skip, skip + pageSize)
      : filteredSolicitations;

    const debugProtocols = [
      "RQ2026-00189",
      "RQ2026-00190",
      "RQ2026-00345",
      "RQ2026-00196",
      "RQ2026-00197",
    ];
    const debugProtocolRows =
      process.env.DEBUG_SOLICITACOES_RECEBIDAS === "true"
        ? await prisma.solicitation.findMany({
            where: { protocolo: { in: debugProtocols } },
            select: {
              protocolo: true,
              status: true,
              tipoId: true,
              approverId: true,
              assumidaPorId: true,
              departmentId: true,
            },
          })
        : [];
    const returnedProtocols = new Set(
      pagedSolicitations.map((item) => item.protocolo).filter(Boolean),
    );
    const existingDebugProtocols = new Set(
      debugProtocolRows.map((item) => item.protocolo).filter(Boolean),
    );

    debugReceivedSolicitations("query-result", {
      userId: me.id,
      total,
      dbTotal,
      returned: pagedSolicitations.length,
      rows: pagedSolicitations.map((item) => ({
        protocolo: item.protocolo,
        status: item.status,
        tipoId: item.tipoId,
        approverId: item.approverId,
        assumidaPorId: item.assumidaPorId,
        departmentId: item.departmentId,
      })),
      testProtocolDiagnostics: debugProtocols.map((protocolo) => {
        const candidate = debugProtocolRows.find((item) => item.protocolo === protocolo);
        return {
          protocolo,
          status: candidate?.status ?? null,
          tipoId: candidate?.tipoId ?? null,
          motivo: returnedProtocols.has(protocolo)
            ? "incluido_no_resultado"
            : existingDebugProtocols.has(protocolo)
              ? "nao_retornado_por_where_filtros_ou_paginacao"
              : "protocolo_nao_encontrado",
        };
      }),
    });

    const rows = pagedSolicitations.map((s) => {
      const finalizadorEvent =
        s.eventos?.find((event) =>
          [
            "FINALIZADA",
            "FINALIZADA_RH",
            "FINALIZADA_DP",
            "FINALIZADA_TI",
          ].includes(event.tipo),
        ) ?? null;
      const responsible = resolvePrimaryResponsibleForList({
        tipo: s.tipo,
        assumidaPor: s.assumidaPor,
        assumidaPorId: s.assumidaPorId,
        approver: s.approver,
        approverId: s.approverId,
        status: s.status,
      });

      return {
        id: s.id,
        titulo: s.titulo,
        status: s.status,
        protocolo: s.protocolo,
        createdAt: s.dataAbertura ? s.dataAbertura.toISOString() : null,
        tipo: s.tipo ? { id: s.tipo.id, codigo: s.tipo.codigo, nome: s.tipo.nome } : null,
        responsavelId: responsible.responsavelId,
        responsavel: responsible.responsavel,
        finalizadorId: finalizadorEvent?.actor?.id ?? null,
        finalizador: finalizadorEvent?.actor
          ? { fullName: finalizadorEvent.actor.fullName }
          : null,
        autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,
        solicitanteNome: s.solicitante?.fullName ?? null,
        sla: null,
        setorDestino:
          s.department?.name ?? formatCostCenterLabel(s.costCenter, ""),
        departamentoResponsavel: s.department?.name ?? null,
        requiresApproval: s.requiresApproval,
        approvalStatus: s.approvalStatus,
        costCenterId: s.costCenterId ?? null,
        approverId: s.approver?.id ?? s.approverId ?? null,
        sharedHiringFlowLabel: resolveSharedHiringFlowLabel(
          {
            tipoId: s.tipoId,
            status: s.status,
            payload: s.payload,
            department: s.department,
            costCenter: s.costCenter,
            parentId: s.parentId,
            parent: s.parent,
            tipo: s.tipo,
          },
          userAccess.isRhAuthorizedForSharedHiringFlow,
        ),
        nadaConstaStatus:
          s.solicitacaoSetores.length === 0
            ? null
            : s.solicitacaoSetores.every(
                  (setor) =>
                    setor.status === "CONCLUIDO" && Boolean(setor.constaFlag),
                )
              ? "PREENCHIDO"
              : "PENDENTE",
      };
    });

    const protocolFilterDiagnostic =
      total === 0 && searchParams.get("protocolo")
        ? await resolveProtocolFilterDiagnostic({
            protocolo: searchParams.get("protocolo") ?? "",
            selectedTipoId: searchParams.get("tipoId") ?? undefined,
            me,
            userAccess,
            receivedVisibilityWhere,
            userDepartmentIdsForSensitive,
            hasScopeVisibilityPostFilter,
          })
        : { status: "not_checked" as const };

    return NextResponse.json({ rows, total, protocolFilterDiagnostic });
  } catch (err) {
    console.error("GET /api/solicitacoes/recebidas error", err);
    if (err instanceof Error && err.message === "Usuário não autenticado") {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof Error && err.message === "Usuário inativo") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (
      err instanceof Error &&
      err.message ===
        "Serviço indisponível. Não foi possível conectar ao banco de dados."
    ) {
      return NextResponse.json(
        { error: err.message, dbUnavailable: true },
        { status: 503 },
      );
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2021" &&
      err.meta?.table === "public.SolicitacaoSetor"
    ) {
      return NextResponse.json(
        {
          error:
            "Erro de configuração: tabela SolicitacaoSetor ausente. Execute as migrations do Prisma.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Erro ao buscar solicitações recebidas." },
      { status: 500 },
    );
  }
}
