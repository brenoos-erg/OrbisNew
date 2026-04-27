import { ModuleLevel, SolicitationPriority } from '@prisma/client'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { isModuleLevelAtLeast } from '@/lib/moduleLevel'

export const TI_DEPARTMENT_CODE = '20'
export const TI_CATALOG_CODES = [
  'RQ.TI.001',
  'RQ.TI.002',
  'RQ.TI.003',
  'RQ.TI.004',
  'RQ.TI.005',
  'RQ.TI.006',
  'RQ.TI.007',
] as const

export const TI_SLA_HOURS_BY_PRIORITY: Record<SolicitationPriority, number> = {
  URGENTE: 4,
  ALTA: 8,
  MEDIA: 16,
  BAIXA: 40,
}

export function isTiCatalogCode(code?: string | null) {
  if (!code) return false
  const normalized = code.trim().toUpperCase()
  return TI_CATALOG_CODES.includes(normalized as (typeof TI_CATALOG_CODES)[number])
}

export function resolveTiRequiresApprovalByPayload(code?: string | null, payload?: any) {
  const normalized = (code ?? '').trim().toUpperCase()

  if (normalized === 'RQ.TI.003') {
    const tipoSolicitacaoRecurso = String(payload?.campos?.tipoSolicitacaoRecurso ?? '')
      .trim()
      .toUpperCase()
    const needsApproval = ['NOVO RECURSO', 'SUBSTITUIÇÃO', 'SUBSTITUICAO', 'ALTERAÇÃO DE PLANO', 'ALTERACAO DE PLANO']
    return needsApproval.includes(tipoSolicitacaoRecurso)
  }

  if (normalized === 'RQ.TI.007') {
    const tipoSolicitacaoSistema = String(payload?.campos?.tipoSolicitacaoSistema ?? '')
      .trim()
      .toUpperCase()
    if (['ERRO/BUG', 'ERRO', 'BUG', 'LENTIDÃO/PERFORMANCE', 'LENTIDAO/PERFORMANCE'].includes(tipoSolicitacaoSistema)) {
      return false
    }
    return true
  }

  if (normalized === 'RQ.TI.001') return false
  if (normalized === 'RQ.TI.002') return true
  if (normalized === 'RQ.TI.004') return true
  if (normalized === 'RQ.TI.005') return false
  if (normalized === 'RQ.TI.006') return true

  return null
}

export function computeTiDueDate(priority: SolicitationPriority | null | undefined, openedAt: Date) {
  if (!priority) return null
  const hours = TI_SLA_HOURS_BY_PRIORITY[priority]
  if (!hours) return null
  return new Date(openedAt.getTime() + hours * 60 * 60 * 1000)
}

export function canAccessTiOperationalPanel(input: {
  role?: string | null
  departmentCode?: string | null
  moduleLevels?: Record<string, ModuleLevel>
}) {
  if ((input.role ?? '').toUpperCase() === 'ADMIN') return true
  if ((input.departmentCode ?? '').trim() === TI_DEPARTMENT_CODE) return true

  const level = input.moduleLevels?.[MODULE_KEYS.EQUIPAMENTOS_TI]
  return level ? isModuleLevelAtLeast(level, 'NIVEL_2') : false
}
