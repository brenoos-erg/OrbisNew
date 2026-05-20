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
    where.AND = [...toAndArray(where.AND), receivedVisibilityWhere];

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
        tipo: s.tipo ? { codigo: s.tipo.codigo, nome: s.tipo.nome } : null,
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

    return NextResponse.json({ rows, total });
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
