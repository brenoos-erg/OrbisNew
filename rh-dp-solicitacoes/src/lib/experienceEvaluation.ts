import { prisma } from '@/lib/prisma'
import { EXPERIENCE_EVALUATOR_GROUP_NAME } from '@/lib/experienceEvaluation.constants'

export { 
  EXPERIENCE_EVALUATOR_GROUP_NAME,
  EXPERIENCE_EVALUATION_FINALIZATION_STATUS,
  EXPERIENCE_EVALUATION_REQUIRED_FIELDS,
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
} from '@/lib/experienceEvaluation.constants'

export async function listExperienceEvaluators() {
  const group = await prisma.approverGroup.findFirst({
    where: { name: EXPERIENCE_EVALUATOR_GROUP_NAME },
    select: {
      members: {
        select: {
          user: { select: { id: true, fullName: true } },
        },
      },
    },
  })

  if (!group) return [] as Array<{ id: string; fullName: string }>

  return group.members
    .map((member) => member.user)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
}

export async function resolveRhDepartmentForExperienceEvaluation() {
  const rhDepartment = await prisma.department.findFirst({
    where: {
      OR: [{ code: '17' }, { sigla: { contains: 'RH' } }, { name: { contains: 'Recursos Humanos' } }],
    },
    select: { id: true },
  })

  if (!rhDepartment) return null

  const rhCostCenter = await prisma.costCenter.findFirst({
    where: {
      OR: [
        { departmentId: rhDepartment.id },
        { externalCode: '490' },
        { description: { contains: 'Recursos Humanos' } },
        { abbreviation: { contains: 'RH' } },
        { code: { contains: 'RH' } },
      ],
    },
    orderBy: [{ departmentId: 'desc' }, { description: 'asc' }],
    select: { id: true },
  })

  return {
    departmentId: rhDepartment.id,
    costCenterId: rhCostCenter?.id ?? null,
  }
}

type Dict = Record<string, unknown>

const asRecord = (value: unknown): Dict => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Dict
}

const readString = (obj: Dict, key: string): string => {
  const value = obj[key]
  return typeof value === 'string' ? value.trim() : ''
}

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('pt-BR')

export function resolveExperienceEvaluationAssignedEvaluator(payload: unknown) {
  const root = asRecord(payload)
  const campos = asRecord(root.campos)
  const metadata = asRecord(root.metadata)
  const requestData = asRecord(root.requestData)
  const dynamicForm = asRecord(root.dynamicForm)

  const merged = {
    ...requestData,
    ...metadata,
    ...dynamicForm,
    ...campos,
  }

  return {
    id:
      readString(merged, 'gestorImediatoAvaliadorId') ||
      readString(merged, 'avaliadorId') ||
      readString(merged, 'gestorId'),
    login:
      readString(merged, 'gestorImediatoAvaliadorLogin') ||
      readString(merged, 'avaliadorLogin') ||
      readString(merged, 'gestorLogin'),
    email:
      readString(merged, 'gestorImediatoAvaliadorEmail') ||
      readString(merged, 'avaliadorEmail') ||
      readString(merged, 'gestorEmail'),
    fullName:
      readString(merged, 'gestorImediatoAvaliador') ||
      readString(merged, 'avaliador') ||
      readString(merged, 'gestor'),
  }
}

export function isExperienceEvaluationEvaluator(
  solicitation: { payload?: unknown; approverId?: string | null },
  user: { id?: string | null; login?: string | null; email?: string | null; fullName?: string | null },
) {
  const assigned = resolveExperienceEvaluationAssignedEvaluator(solicitation.payload)
  const userId = String(user.id ?? '').trim()
  const userLogin = normalize(user.login)
  const userEmail = normalize(user.email)
  const userFullName = normalize(user.fullName)

  if (assigned.id) return assigned.id === userId
  if (assigned.login) return normalize(assigned.login) === userLogin
  if (assigned.email) return normalize(assigned.email) === userEmail
  if (assigned.fullName) return normalize(assigned.fullName) === userFullName

  return Boolean(userId) && String(solicitation.approverId ?? '').trim() === userId
}
