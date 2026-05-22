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
};

type SolicitationLike = {
  tipoId?: string | null;
  status?: string | null;
  solicitanteId: string;
  approverId?: string | null;
  assumidaPorId?: string | null;
  departmentId?: string | null;
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


export function normalizeSectorKey(value: unknown): string {
  const normalized = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

  if (!normalized) return ''

  if (['saude ocupacional', 'saude'].includes(normalized)) return 'saude ocupacional'
  if (['seguranca do trabalho', 'sst', 'seguranca'].includes(normalized)) return 'seguranca do trabalho'
  if (['tecnologia da informacao', 'ti', 'informatica'].includes(normalized)) return 'tecnologia da informacao'
  if (['departamento pessoal', 'dp'].includes(normalized)) return 'departamento pessoal'
  if (['recursos humanos', 'rh'].includes(normalized)) return 'recursos humanos'
  if (['logistica'].includes(normalized)) return 'logistica'
  if (['almoxarifado'].includes(normalized)) return 'almoxarifado'

  return normalized
}

export function extractNadaConstaSectorKeys(
  solicitation: Record<string, unknown>,
): string[] {
  const sectors = collectSectorCandidates({
    solicitacaoSetores: solicitation.solicitacaoSetores,
    setorDestino: solicitation.setorDestino,
    departamentoResponsavel: solicitation.departamentoResponsavel,
    centroCusto: solicitation.centroCusto,
    costCenter: solicitation.costCenter,
    payload: solicitation.payload,
  });
  return [...sectors];
}

export function isNadaConstaSolicitation(solicitationOrTipo: unknown): boolean {
  const record = (solicitationOrTipo ?? {}) as Record<string, unknown>
  const tipo = (record.tipo && typeof record.tipo === 'object' ? record.tipo : record) as Record<string, unknown>
  const tipoNome = String(tipo.nome ?? record.tipoNome ?? '').toLowerCase()
  const tipoCodigo = String(tipo.codigo ?? record.tipoCodigo ?? '').toLowerCase()
  const tipoId = String(tipo.id ?? record.tipoId ?? '').toLowerCase()
  const payloadText = JSON.stringify(record.payload ?? {}).toLowerCase()

  return tipoNome.includes('nada consta') ||
    tipoCodigo.includes('nada') ||
    tipoId.includes('rq_300') ||
    tipoId.includes('nada_consta') ||
    payloadText.includes('nada consta') ||
    payloadText.includes('nadaconsta')
}

function collectSectorCandidates(value: unknown, found = new Set<string>()) {
  if (typeof value === 'string') {
    const key = normalizeSectorKey(value)
    if (key) found.add(key)
    return found
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSectorCandidates(item, found)
    return found
  }
  if (!value || typeof value !== 'object') return found
  const rec = value as Record<string, unknown>
  for (const [k,v] of Object.entries(rec)) {
    const lk = k.toLowerCase()
    if (['setor','departamento','setordestino','departamentoresponsavel','name','nome','descricao','description','centrocusto','costcenter'].includes(lk) && typeof v === 'string') {
      const key = normalizeSectorKey(v)
      if (key) found.add(key)
    }
    collectSectorCandidates(v, found)
  }
  return found
}

export function userCanSeeNadaConstaBySector(
  userScope: Pick<SolicitationVisibilityInput, 'userDepartmentNamesNormalized' | 'userSectorNamesNormalized' | 'userCostCenterIds' | 'userDepartmentIds'>,
  solicitation: Record<string, unknown>,
): boolean {
  if (!isNadaConstaSolicitation(solicitation)) return false
  const solicitationDepartmentId = String(solicitation.departmentId ?? '')
  const solicitationCostCenterId = String(solicitation.costCenterId ?? '')
  if (solicitationDepartmentId && userScope.userDepartmentIds.includes(solicitationDepartmentId)) return true
  if (solicitationCostCenterId && userScope.userCostCenterIds.includes(solicitationCostCenterId)) return true

  const names = new Set<string>([
    ...userScope.userDepartmentNamesNormalized.map(normalizeSectorKey),
    ...userScope.userSectorNamesNormalized.map(normalizeSectorKey),
  ].filter(Boolean))
  if (names.size === 0) return false

  const sectors = extractNadaConstaSectorKeys(solicitation)

  for (const s of sectors) {
    if (names.has(s)) return true
  }
  return false
}
export function buildReceivedSolicitationVisibilityWhere(
  input: SolicitationVisibilityInput,
): Prisma.SolicitationWhereInput {
  if (input.role === "ADMIN") {
    return {};
  }

  const regularSolicitationOrFilters: Prisma.SolicitationWhereInput[] = [
    { assumidaPorId: input.userId },
    { solicitanteId: input.userId },
  ];

  if (input.userDepartmentIds.length > 0) {
    regularSolicitationOrFilters.push({
      departmentId: {
        in: input.userDepartmentIds,
      },
    });
  }
  if (input.userCostCenterIds.length > 0) {
    regularSolicitationOrFilters.push({
      costCenterId: {
        in: input.userCostCenterIds,
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
  if (input.allowedTipoIds.length > 0) {
    regularSolicitationOrFilters.push({
      tipoId: {
        in: input.allowedTipoIds,
      },
    });
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
        ...(input.allowedTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
        (input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID)
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
    input.allowedTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
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
    solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID &&
    onlyValidSolicitationStatuses([
      EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
      "CONCLUIDA",
      "FINALIZADA",
    ]).includes(solicitation.status as never) &&
    (input.finalizerTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
      input.isExperienceEvaluationCoordinator ||
      input.isRhAuthorizedForExperienceEvaluation ||
      input.allowedTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
      (input.viewerTipoIds ?? []).includes(EXPERIENCE_EVALUATION_TIPO_ID))
  ) {
    return true;
  }
  if (solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID) {
    if (
      EXPERIENCE_EVALUATION_VISIBLE_STATUSES.includes(solicitation.status as never) &&
      (input.isRhAuthorizedForExperienceEvaluation ||
        input.isExperienceEvaluationCoordinator ||
        input.allowedTipoIds.includes(EXPERIENCE_EVALUATION_TIPO_ID) ||
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

  if (
    solicitation.tipoId &&
    input.allowedTipoIds.includes(solicitation.tipoId)
  ) {
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
