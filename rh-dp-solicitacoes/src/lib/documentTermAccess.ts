import { PrismaClient } from '@prisma/client'

export type TermChallengePayload = {
  requiresTerm: true
  term: {
    id: string
    title: string
    content: string
  }
}

export async function resolveTermChallenge(prisma: PrismaClient, userId: string): Promise<TermChallengePayload | null> {
  const term = await prisma.documentResponsibilityTerm.findFirst({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, content: true },
  })

  if (!term) return null

  const acceptance = await prisma.documentTermAcceptance.findUnique({
    where: { termId_userId: { termId: term.id, userId } },
    select: { id: true },
  })

  if (acceptance) return null

  return {
    requiresTerm: true,
    term: {
      id: term.id,
      title: term.title,
      content: term.content,
    },
  }
}