import type { Prisma, Role } from '@prisma/client'
import {
  NADA_CONSTA_SETORES,
  isSolicitacaoNadaConsta,
  resolveNadaConstaSetoresByDepartment,
  type NadaConstaSetorKey,
} from '@/lib/solicitationTypes'

type DepartmentLike = { id?: string | null; code?: string | null; name?: string | null }

type NadaConstaSolicitationLike = {
  solicitanteId: string
  assumidaPorId?: string | null
  approverId?: string | null
  tipo?: { id?: string | null; nome?: string | null; schemaJson?: unknown } | null
  solicitacaoSetores?: { setor?: string | null; finalizadoPor?: string | null }[]
  payload?: unknown
}

type UserLike = {
  id: string
  role: Role
  departments: DepartmentLike[]
}

const NADA_CONSTA_STAGE_PREFIXES: Record<NadaConstaSetorKey, string[]> = {
  DP: ['dp'],
  TI: ['ti'],
  ALMOX: ['almox'],
  LOGISTICA: ['log', 'logistica'],
  SST: ['sst'],
  SAUDE: ['saude'],
  FINANCEIRO: ['financeiro'],
  FISCAL: ['fiscal'],
}

function normalizeSetor(value?: string | null): NadaConstaSetorKey | null {
  if (!value) return null
  const normalized = value.toUpperCase().trim()
  const found = NADA_CONSTA_SETORES.find((setor) => setor.key === normalized)
  return found?.key ?? null
}

function resolveSetoresFromPayload(payload: unknown): Set<NadaConstaSetorKey> {
  const resolved = new Set<NadaConstaSetorKey>()
  if (!payload || typeof payload !== 'object') return resolved

  const payloadRecord = payload as Record<string, unknown>
  const campos = payloadRecord.campos
  if (!campos || typeof campos !== 'object') return resolved

  const keys = Object.keys(campos as Record<string, unknown>).map((key) => key.toLowerCase())
  for (const setor of NADA_CONSTA_SETORES) {
    const prefixes = NADA_CONSTA_STAGE_PREFIXES[setor.key]
    if (keys.some((key) => prefixes.some((prefix) => key.startsWith(prefix)))) {
      resolved.add(setor.key)
    }
  }

  return resolved
}

export function resolveNadaConstaFlowSetores(params: {
  tipo?: { id?: string | null; nome?: string | null; schemaJson?: unknown } | null
  solicitacaoSetores?: { setor?: string | null }[]
  payload?: unknown
  departmentsById?: Map<string, DepartmentLike>
}) {
  const resolved = new Set<NadaConstaSetorKey>()

  for (const setorRow of params.solicitacaoSetores ?? []) {
    const setor = normalizeSetor(setorRow.setor)
    if (setor) resolved.add(setor)
  }

  const schemaJson = params.tipo?.schemaJson
  if (schemaJson && typeof schemaJson === 'object') {
    const meta = (schemaJson as { meta?: { departamentos?: unknown; fluxo?: { multiSetor?: unknown } } }).meta
    if (meta?.fluxo?.multiSetor === true) {
      for (const setor of NADA_CONSTA_SETORES) resolved.add(setor.key)
    }

    if (Array.isArray(meta?.departamentos)) {
      for (const deptId of meta.departamentos) {
        if (typeof deptId !== 'string') continue
        const department = params.departmentsById?.get(deptId)
        if (!department) continue
        for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
          resolved.add(setor)
        }
      }
    }
  }

  for (const setor of resolveSetoresFromPayload(params.payload)) {
    resolved.add(setor)
  }

  return resolved
}

export function buildNadaConstaReceivedFilters(setorKeys: Set<string>): Prisma.SolicitationWhereInput[] {
  if (setorKeys.size === 0) return []

  return [
    {
      tipoId: 'RQ_300',
    },
    {
      tipo: {
        nome: {
          contains: 'NADA CONSTA',
        },
      },
    },
  ]
}

export function canUserViewNadaConsta(
  user: UserLike,
  solicitation: NadaConstaSolicitationLike,
  departmentsById?: Map<string, DepartmentLike>,
) {
  if (!isSolicitacaoNadaConsta(solicitation.tipo)) {
    return true
  }

  if (user.role === 'ADMIN') return true
  if (solicitation.solicitanteId === user.id) return true
  if (solicitation.assumidaPorId && solicitation.assumidaPorId === user.id) return true
  if (solicitation.approverId && solicitation.approverId === user.id) return true

  const userSetores = new Set<NadaConstaSetorKey>()
  for (const department of user.departments) {
    for (const setor of resolveNadaConstaSetoresByDepartment(department)) {
      userSetores.add(setor)
    }
  }

  const responsibleUsers = new Set(
    (solicitation.solicitacaoSetores ?? [])
      .map((setor) => setor.finalizadoPor)
      .filter((value): value is string => Boolean(value)),
  )

  if (responsibleUsers.has(user.id)) return true

  const flowSetores = resolveNadaConstaFlowSetores({
    tipo: solicitation.tipo,
    solicitacaoSetores: solicitation.solicitacaoSetores,
    payload: solicitation.payload,
    departmentsById,
  })

  for (const setor of userSetores) {
    if (flowSetores.has(setor)) return true
  }

  return false
}