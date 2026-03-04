import { prisma } from '@/lib/prisma'

export const EXPERIENCE_EVALUATOR_GROUP_NAME = 'COORDENADORES_AVALIACAO_EXPERIENCIA'
export const EXPERIENCE_EVALUATION_TIPO_ID = 'RQ_RH_103'
export const EXPERIENCE_EVALUATION_STATUS = 'AGUARDANDO_AVALIACAO_GESTOR' as const
export const EXPERIENCE_EVALUATION_REQUIRED_FIELDS = [
  'relacionamentoNota',
  'comunicacaoNota',
  'atitudeNota',
  'saudeSegurancaNota',
  'dominioTecnicoProcessosNota',
  'adaptacaoMudancaNota',
  'autogestaoGestaoPessoasNota',
  'comentarioFinal',
] as const

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