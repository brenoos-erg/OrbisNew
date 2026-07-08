import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'

type EpiSolicitationLike = {
  requiresApproval?: boolean | null
  approvalStatus?: string | null
  status?: string | null
  approverId?: string | null
  tipo?: { id?: string | null; codigo?: string | null; nome?: string | null } | null
  anexos?: unknown[] | null
  department?: { code?: string | null; name?: string | null } | null
}

type WarehouseDepartmentLike = {
  id: string
  name: string
  sigla?: string | null
  code?: string | null
}

type WarehouseCostCenterLike = {
  id: string
  departmentId?: string | null
}

type WarehouseResolverClient = {
  department: {
    findFirst(args: unknown): Promise<WarehouseDepartmentLike | null>
  }
  costCenter?: {
    findFirst(args: unknown): Promise<WarehouseCostCenterLike | null>
  }
}

export function isEpiUniformeApprovalPending(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.requiresApproval === true &&
      solicitation.approvalStatus === 'PENDENTE',
  )
}

export function isEpiUniformeWaitingFicha(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.department?.code === '19' &&
      solicitation.requiresApproval === false &&
      solicitation.approvalStatus === 'NAO_PRECISA' &&
      (solicitation.anexos?.length ?? 0) === 0,
  )
}

export function isEpiUniformeReadyToForwardApproval(solicitation?: EpiSolicitationLike | null) {
  return Boolean(
    solicitation &&
      isSolicitacaoEpiUniforme(solicitation.tipo) &&
      solicitation.department?.code === '19' &&
      solicitation.requiresApproval === false &&
      solicitation.approvalStatus === 'NAO_PRECISA' &&
      (solicitation.anexos?.length ?? 0) > 0,
  )
}

export function getEpiUniformeReceivedResponsibilityLabel(solicitation?: EpiSolicitationLike | null) {
  if (isEpiUniformeWaitingFicha(solicitation)) return 'Aguardando SST anexar Ficha de EPI'
  if (isEpiUniformeReadyToForwardApproval(solicitation)) return 'Aguardando encaminhamento para aprovação'
  return null
}


type EpiApprovalVisibilityUserLike = {
  role?: string | null
  userId?: string | null
  id?: string | null
  tipoApproverTipoIds?: Array<string | null | undefined> | null
  solicitationModuleLevel?: string | null
  moduleLevels?: { solicitacoes?: string | null } | null
  departmentIds?: Array<string | null | undefined> | null
  userDepartmentIds?: Array<string | null | undefined> | null
  departmentId?: string | null
}

type EpiApprovalVisibilitySolicitationLike = EpiSolicitationLike & {
  tipoId?: string | null
  departmentId?: string | null
}

export function canUserSeeEpiUniformeApproval(
  solicitation?: EpiApprovalVisibilitySolicitationLike | null,
  user?: EpiApprovalVisibilityUserLike | null,
) {
  if (!isEpiUniformeApprovalPending(solicitation) || !user) return false
  if (user.role === 'ADMIN') return true

  const userId = user.userId ?? user.id ?? null
  if (userId && solicitation?.approverId === userId) return true

  const tipoId = solicitation?.tipoId ?? solicitation?.tipo?.id ?? null
  const approverTipoIds = user.tipoApproverTipoIds ?? []
  if (tipoId && approverTipoIds.includes(tipoId)) return true

  const moduleLevel = user.solicitationModuleLevel ?? user.moduleLevels?.solicitacoes ?? null
  const departmentIds = [
    ...(user.departmentIds ?? []),
    ...(user.userDepartmentIds ?? []),
    user.departmentId ?? '',
  ].filter(Boolean)
  return Boolean(moduleLevel === 'NIVEL_3' && solicitation?.departmentId && departmentIds.includes(solicitation.departmentId))
}

export function buildEpiUniformeForwardApprovalData(approverId: string) {
  return {
    requiresApproval: true,
    approvalStatus: 'PENDENTE' as const,
    approverId,
    status: 'AGUARDANDO_APROVACAO' as const,
  }
}

export function buildEpiUniformeForwardToWarehouseData({
  warehouseDepartmentId,
  warehouseCostCenterId,
}: {
  warehouseDepartmentId: string
  warehouseCostCenterId?: string | null
}) {
  return {
    departmentId: warehouseDepartmentId,
    ...(warehouseCostCenterId ? { costCenterId: warehouseCostCenterId } : { costCenterId: null }),
    status: 'ABERTA' as const,
    requiresApproval: false,
    approvalStatus: 'APROVADO' as const,
    approverId: null,
    assumidaPorId: null,
    assumidaEm: null,
  }
}

export async function resolveWarehouseDepartment(prismaClient: WarehouseResolverClient) {
  return prismaClient.department.findFirst({
    where: {
      OR: [
        { code: '12' },
        { name: { contains: 'Almoxarifado' } },
        { name: { contains: 'Estoque' } },
        { sigla: { contains: 'ALMOX' } },
        { sigla: { contains: 'ESTOQUE' } },
      ],
    },
    select: { id: true, name: true, sigla: true, code: true },
  })
}

export async function resolveWarehouseCostCenter(
  prismaClient: WarehouseResolverClient,
  warehouseDepartmentId: string,
) {
  if (!prismaClient.costCenter) return null
  return prismaClient.costCenter.findFirst({
    where: {
      OR: [
        { departmentId: warehouseDepartmentId },
        { description: { contains: 'Almoxarifado' } },
        { description: { contains: 'Estoque' } },
        { abbreviation: { contains: 'ALMOX' } },
        { abbreviation: { contains: 'ESTOQUE' } },
        { code: { contains: 'ALMOX' } },
        { code: { contains: 'ESTOQUE' } },
      ],
    },
    select: { id: true, departmentId: true },
  })
}


export function assertCanMoveEpiUniformeToSst(moveToSst: boolean, protocols: string[]) {
  if (moveToSst && protocols.length === 0) {
    throw new Error('Para usar --move-to-sst, informe --protocol ou --protocols.')
  }
}

export function buildEpiUniformeMoveToSstData(departmentId: string, costCenterId?: string | null) {
  return {
    departmentId,
    ...(costCenterId ? { costCenterId } : {}),
  }
}
