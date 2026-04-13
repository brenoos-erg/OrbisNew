import { prisma } from '@/lib/prisma'
import { EXPERIENCE_EVALUATOR_GROUP_NAME } from '@/lib/experienceEvaluation.constants'
import {
  isExperienceEvaluationEvaluator,
  resolveExperienceEvaluationAssignedEvaluator,
} from '@/lib/experienceEvaluation.shared'

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

export {
  isExperienceEvaluationEvaluator,
  resolveExperienceEvaluationAssignedEvaluator,
}