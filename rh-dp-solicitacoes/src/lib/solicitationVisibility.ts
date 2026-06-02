import { Prisma, Role } from "@prisma/client";
import { resolveNadaConstaSetoresByDepartment } from "@/lib/solicitationTypes";
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  EXPERIENCE_EVALUATION_VISIBLE_STATUSES,
} from "@/lib/experienceEvaluation";
import { onlyValidSolicitationStatuses } from "@/lib/solicitationStatuses";

type DepartmentLike = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

type SolicitationVisibilityInput = {
  userId: string;
  userLogin?: string | null;
  userEmail?: string | null;
  userFullName?: string | null;
  role: Role;
  userDepartmentIds: string[];
  userCostCenterIds: string[];
  userDepartmentNamesNormalized: string[];
  userSectorNamesNormalized: string[];
  userSetorKeys: string[];
  finalizerTipoIds: string[];
  allowedTipoIds: string[];
  viewerTipoIds?: string[];
  isExperienceEvaluationCoordinator: boolean;
  isRhAuthorizedForExperienceEvaluation: boolean;
  isRhAuthorizedForSharedHiringFlow?: boolean;
};

type SolicitationLike = {
  tipoId?: string | null;
  status?: string | null;
  solicitanteId?: string | null;
  approverId?: string | null;
  assumidaPorId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  parentId?: string | null;
  payload?: unknown;
  parent?: { tipoId?: string | null; tipo?: { codigo?: string | null; nome?: string | null } | null } | null;
  tipo?: { codigo?: string | null; nome?: string | null } | null;
  solicitacaoSetores?: { setor?: string | null }[];
};

export function resolveUserSetorKeysFromDepartments(
  departments: DepartmentLike[],
) {
  const setorKeys = new Set<string>();

  for (const department of departments) {
    for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
      setorKeys.add(setor);
    }
  }

  return [...setorKeys];
}

export const SOLICITACAO_PESSOAL_TIPO_IDS = ["RQ_063"] as const;
export const SOLICITACAO_PESSOAL_CODIGOS = ["RQ.RH.063", "RQ.063", "RQ.RH.001"] as const;
export const SOLICITACAO_ADMISSAO_TIPO_IDS = ["SOLICITACAO_ADMISSAO"] as const;
export const SOLICITACAO_ADMISSAO_CODIGOS = ["RQ.DP.001"] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function isSolicitacaoPessoalSharedFlowRecord(solicitation: SolicitationLike) {
  const tipoId = normalizeText(solicitation.tipoId);
  const codigo = normalizeText(solicitation.tipo?.codigo);
  const nome = normalizeText(solicitation.tipo?.nome);

  return (
    SOLICITACAO_PESSOAL_TIPO_IDS.includes(tipoId as never) ||
    SOLICITACAO_PESSOAL_CODIGOS.includes(codigo as never) ||
    nome.includes("RQ_063") ||
    nome.includes("RQ.063") ||
    nome.includes("RQ.RH.063") ||
    nome.includes("SOLICITACAO DE PESSOAL")
  );
}

function isSolicitacaoAdmissaoRecord(solicitation: SolicitationLike) {
  const tipoId = normalizeText(solicitation.tipoId);
  const codigo = normalizeText(solicitation.tipo?.codigo);
  const nome = normalizeText(solicitation.tipo?.nome);

  return (
    SOLICITACAO_ADMISSAO_TIPO_IDS.includes(tipoId as never) ||
    SOLICITACAO_ADMISSAO_CODIGOS.includes(codigo as never) ||
    nome.includes("SOLICITACAO DE ADMISSAO")
  );
}

function hasRhSolicitationOrigin(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const origem = (payload as { origem?: unknown }).origem;
  if (!origem || typeof origem !== "object") return false;
  return Boolean(
    (origem as { rhSolicitationId?: unknown }).rhSolicitationId ||
      (origem as { rhProtocolo?: unknown }).rhProtocolo,
  );
}

export function isLinkedAdmissionFromSharedHiringFlow(solicitation: SolicitationLike) {
  if (!isSolicitacaoAdmissaoRecord(solicitation)) return false;
  if (hasRhSolicitationOrigin(solicitation.payload)) return true;
  if (solicitation.parentId && isSolicitacaoPessoalSharedFlowRecord({
    tipoId: solicitation.parent?.tipoId,
    tipo: solicitation.parent?.tipo ?? null,
    solicitanteId: solicitation.solicitanteId,
  })) {
    return true;
  }

  return false;
}

function buildSolicitacaoPessoalSharedFlowWhere(): Prisma.SolicitationWhereInput {
  return {
    OR: [
      { tipoId: { in: [...SOLICITACAO_PESSOAL_TIPO_IDS] } },
      { tipo: { codigo: { in: [...SOLICITACAO_PESSOAL_CODIGOS] } } },
      { tipo: { nome: { contains: "Solicitação de Pessoal" } } },
    ],
  };
}

function buildSolicitacaoAdmissaoWhere(): Prisma.SolicitationWhereInput {
  return {
    OR: [
      { tipoId: { in: [...SOLICITACAO_ADMISSAO_TIPO_IDS] } },
      { tipo: { codigo: { in: [...SOLICITACAO_ADMISSAO_CODIGOS] } } },
      { tipo: { nome: { contains: "Solicitação de Admissão" } } },
      { tipo: { nome: { contains: "Solicitação de admissão" } } },
    ],
  };
}

function buildLinkedAdmissionFromSharedHiringFlowWhere(): Prisma.SolicitationWhereInput {
  return {
    AND: [
      buildSolicitacaoAdmissaoWhere(),
      {
        OR: [
          { parent: buildSolicitacaoPessoalSharedFlowWhere() },
          { payload: { path: "$.origem.rhSolicitationId", not: Prisma.JsonNull } },
          { payload: { path: "$.origem.rhProtocolo", not: Prisma.JsonNull } },
        ],
      },
    ],
  };
}

export function buildRhSharedHiringFlowVisibilityWhere(): Prisma.SolicitationWhereInput {
  return {
    OR: [
      buildSolicitacaoPessoalSharedFlowWhere(),
      buildLinkedAdmissionFromSharedHiringFlowWhere(),
    ],
  };
}

function isRhAuthorizedForSharedHiringFlow(input: SolicitationVisibilityInput) {
  return Boolean(input.isRhAuthorizedForSharedHiringFlow);
}

export function buildReceivedSolicitationVisibilityWhere(
  input: SolicitationVisibilityInput,
): Prisma.SolicitationWhereInput {
  if (input.role === "ADMIN") {
    return {};
  }

  const regularSolicitationOrFilters: Prisma.SolicitationWhereInput[] = [
    { assumidaPorId: input.userId },
  ];

  if (input.userDepartmentIds.length > 0) {
    regularSolicitationOrFilters.push({
      departmentId: {
        in: input.userDepartmentIds,
      },
    });
  }
  if (input.userSetorKeys.length > 0) {
    regularSolicitationOrFilters.push({
      solicitacaoSetores: {
        some: {
          setor: {
            in: input.userSetorKeys,
          },
        },
      },
    });
  }
  if ((input.viewerTipoIds ?? []).length > 0) {
    regularSolicitationOrFilters.push({
      tipoId: {
        in: input.viewerTipoIds,
      },
    });
  }

  if (isRhAuthorizedForSharedHiringFlow(input)) {
    regularSolicitationOrFilters.push(buildRhSharedHiringFlowVisibilityWhere());
  }

  const evaluatorPayloadFilters = buildExperienceEvaluatorPayloadFilters(input);
  const experienceEvaluationVisibleStatuses =
    EXPERIENCE_EVALUATION_VISIBLE_STATUSES;
  const experienceEvaluationFinalizedStatuses = onlyValidSolicitationStatuses([
    EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
    "CONCLUIDA",
    "FINALIZADA",
  ]);

  const orFilters: Prisma.SolicitationWhereInput[] = [
    {
      tipoId: { not: EXPERIENCE_EVALUATION_TIPO_ID },
      OR: regularSolicitationOrFilters,
    },
    {
      tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
      ...(experienceEvaluationVisibleStatuses.length > 0
        ? { status: { in: experienceEvaluationVisibleStatuses } }
        : {}),
      OR: [
        { solicitanteId: input.userId },
        { approverId: input.userId },
        ...(input.isExperienceEvaluationCoordinator ||
        input.isRhAuthorizedForExperienceEvaluation
          ? [{ id: { not: "" } }]
          : []),
        ...((input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID)
          ? [{ id: { not: "" } }]
          : []),
        {
          AND: [
            { OR: [{ approverId: null }, { approverId: "" }] },
            ...(evaluatorPayloadFilters.length > 0
              ? [{ OR: evaluatorPayloadFilters }]
              : []),
          ],
        },
      ],
    },
  ];

  if (
    input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
    (input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
    input.isExperienceEvaluationCoordinator ||
    input.isRhAuthorizedForExperienceEvaluation
  ) {
    if (experienceEvaluationFinalizedStatuses.length > 0) {
      orFilters.push({
        tipoId: EXPERIENCE_EVALUATION_TIPO_ID,
        status: { in: experienceEvaluationFinalizedStatuses },
      });
    }
  }
  return {
    OR: orFilters,
  };
}

function buildExperienceEvaluatorPayloadFilters(
  input: Pick<
    SolicitationVisibilityInput,
    "userId" | "userLogin" | "userEmail" | "userFullName"
  >,
) {
  const userLogin = input.userLogin?.trim();
  const userEmail = input.userEmail?.trim();
  const userFullName = input.userFullName?.trim();

  const idPaths = [
    "$.campos.gestorImediatoAvaliadorId",
    "$.metadata.gestorImediatoAvaliadorId",
    "$.requestData.gestorImediatoAvaliadorId",
    "$.dynamicForm.gestorImediatoAvaliadorId",
    "$.campos.avaliadorId",
    "$.metadata.avaliadorId",
    "$.requestData.avaliadorId",
    "$.dynamicForm.avaliadorId",
    "$.campos.gestorId",
    "$.metadata.gestorId",
    "$.requestData.gestorId",
    "$.dynamicForm.gestorId",
  ];

  const filters: Prisma.SolicitationWhereInput[] = idPaths.map((path) => ({
    payload: { path, equals: input.userId },
  }));

  if (userLogin) {
    for (const path of [
      "$.campos.gestorImediatoAvaliadorLogin",
      "$.metadata.gestorImediatoAvaliadorLogin",
      "$.requestData.gestorImediatoAvaliadorLogin",
      "$.dynamicForm.gestorImediatoAvaliadorLogin",
      "$.campos.avaliadorLogin",
      "$.metadata.avaliadorLogin",
      "$.requestData.avaliadorLogin",
      "$.dynamicForm.avaliadorLogin",
      "$.campos.gestorLogin",
      "$.metadata.gestorLogin",
      "$.requestData.gestorLogin",
      "$.dynamicForm.gestorLogin",
    ]) {
      filters.push({ payload: { path, equals: userLogin } });
    }
  }

  if (userEmail) {
    for (const path of [
      "$.campos.gestorImediatoAvaliadorEmail",
      "$.metadata.gestorImediatoAvaliadorEmail",
      "$.requestData.gestorImediatoAvaliadorEmail",
      "$.dynamicForm.gestorImediatoAvaliadorEmail",
      "$.campos.avaliadorEmail",
      "$.metadata.avaliadorEmail",
      "$.requestData.avaliadorEmail",
      "$.dynamicForm.avaliadorEmail",
      "$.campos.gestorEmail",
      "$.metadata.gestorEmail",
      "$.requestData.gestorEmail",
      "$.dynamicForm.gestorEmail",
    ]) {
      filters.push({ payload: { path, equals: userEmail } });
    }
  }

  if (userFullName) {
    for (const path of [
      "$.campos.gestorImediatoAvaliador",
      "$.metadata.gestorImediatoAvaliador",
      "$.requestData.gestorImediatoAvaliador",
      "$.dynamicForm.gestorImediatoAvaliador",
      "$.campos.avaliador",
      "$.metadata.avaliador",
      "$.requestData.avaliador",
      "$.dynamicForm.avaliador",
      "$.campos.gestor",
      "$.metadata.gestor",
      "$.requestData.gestor",
      "$.dynamicForm.gestor",
    ]) {
      filters.push({ payload: { path, equals: userFullName } });
    }
  }

  return filters;
}

export function canUserViewSolicitationByDepartment(
  input: SolicitationVisibilityInput,
  solicitation: SolicitationLike,
) {
  if (input.role === "ADMIN") return true;
  if (solicitation.solicitanteId === input.userId) return true;
  if (solicitation.assumidaPorId === input.userId) return true;
  if (
    isRhAuthorizedForSharedHiringFlow(input) &&
    (isSolicitacaoPessoalSharedFlowRecord(solicitation) ||
      isLinkedAdmissionFromSharedHiringFlow(solicitation))
  ) {
    return true;
  }
  if (
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    onlyValidSolicitationStatuses([
      EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
      "CONCLUIDA",
      "FINALIZADA",
    ]).includes(solicitation.status as never) &&
    (input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
      input.isExperienceEvaluationCoordinator ||
      input.isRhAuthorizedForExperienceEvaluation ||
      (input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID))
  ) {
    return true;
  }
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) {
    if (
      EXPERIENCE_EVALUATION_VISIBLE_STATUSES.includes(solicitation.status as never) &&
      (input.isRhAuthorizedForExperienceEvaluation ||
        input.isExperienceEvaluationCoordinator ||
        (input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID))
    ) {
      return true;
    }
    return false;
  }

  if (
    isUserInResponsibleDepartment(
      input.userDepartmentIds,
      solicitation.departmentId,
    )
  ) {
    return true;
  }

  const solicitationSetores = new Set(
    (solicitation.solicitacaoSetores ?? [])
      .map((setor) => setor.setor)
      .filter((setor): setor is string => Boolean(setor)),
  );

  if (solicitationSetores.size > 0) {
    for (const userSetor of input.userSetorKeys) {
      if (solicitationSetores.has(userSetor)) return true;
    }
  }

  if (solicitation.tipoId && (input.viewerTipoIds ?? []).includes(solicitation.tipoId)) {
    return true;
  }

  return false;
}

export function isUserInResponsibleDepartment(
  userDepartmentIds: string[],
  solicitationDepartmentId?: string | null,
) {
  if (!solicitationDepartmentId) return false;
  return userDepartmentIds.includes(solicitationDepartmentId);
}
