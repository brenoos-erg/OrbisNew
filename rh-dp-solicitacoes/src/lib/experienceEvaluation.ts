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