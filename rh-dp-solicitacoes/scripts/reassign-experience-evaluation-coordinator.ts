import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import {
  EXPERIENCE_EVALUATION_TIPO_ID,
  patchExperienceEvaluationEvaluatorPayload,
  resolveExperienceEvaluationAssignedEvaluator,
} from '@/lib/experienceEvaluation'

const prisma = new PrismaClient()

function usage() {
  console.log('Uso: npm run avaliacoes:reassign -- <protocolo> <login|email|nome> [actorId]')
}

async function main() {
  const [protocolo, novoCoordenador, actorIdArg] = process.argv.slice(2)
  if (!protocolo || !novoCoordenador) {
    usage()
    process.exitCode = 1
    return
  }

  const solicitation = await prisma.solicitation.findUnique({ where: { protocolo } })
  if (!solicitation) throw new Error(`Solicitação ${protocolo} não encontrada.`)
  if (solicitation.tipoId !== EXPERIENCE_EVALUATION_TIPO_ID) {
    throw new Error(`Solicitação ${protocolo} não é ${EXPERIENCE_EVALUATION_TIPO_ID}.`)
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { login: novoCoordenador },
        { email: novoCoordenador },
        { fullName: { contains: novoCoordenador } },
      ],
    },
    select: { id: true, fullName: true, login: true, email: true },
  })
  if (!user) throw new Error(`Usuário '${novoCoordenador}' não encontrado.`)

  const old = resolveExperienceEvaluationAssignedEvaluator(solicitation.payload)
  const oldLabel = old.fullName || old.login || old.email || old.id || 'não informado'
  const actorId = actorIdArg || user.id

  await prisma.$transaction([
    prisma.solicitation.update({
      where: { id: solicitation.id },
      data: {
        approverId: user.id,
        payload: patchExperienceEvaluationEvaluatorPayload(solicitation.payload, user) as any,
      },
    }),
    prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: solicitation.id,
        actorId,
        tipo: `Coordenador da avaliação alterado de ${oldLabel} para ${user.fullName} por ajuste administrativo.`,
      },
    }),
    prisma.solicitationTimeline.create({
      data: {
        solicitationId: solicitation.id,
        status: String(solicitation.status),
        message: `Coordenador da avaliação alterado de ${oldLabel} para ${user.fullName} por ajuste administrativo.`,
      },
    }),
  ])

  console.log(`Solicitação ${protocolo} reatribuída para ${user.fullName} (${user.login ?? user.email ?? user.id}).`)
}

main()
  .catch((error) => {
    console.error('Falha na reatribuição:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
