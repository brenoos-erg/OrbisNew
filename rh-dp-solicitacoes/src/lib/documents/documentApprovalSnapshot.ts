import type { Prisma } from '@prisma/client'

export async function nextDocumentSourceSnapshotRound(tx: Prisma.TransactionClient, versionId: string) {
  const latest = await tx.documentSourceApproverSnapshot.findFirst({
    where: { versionId },
    orderBy: { roundNumber: 'desc' },
    select: { roundNumber: true },
  })
  return (latest?.roundNumber ?? 0) + 1
}

export async function createDocumentSourceApproverSnapshotRound(
  tx: Prisma.TransactionClient,
  input: {
    versionId: string
    roundNumber?: number
    flow: Array<{
      id: string
      order: number
      stepType: 'REVIEW' | 'QUALITY' | 'SIG' | 'APPROVAL_GENERIC'
      approverGroup?: { members?: Array<{ userId: string; user?: { status?: string | null } | null }> } | null
    }>
  },
) {
  const roundNumber = input.roundNumber ?? await nextDocumentSourceSnapshotRound(tx, input.versionId)
  const rows = input.flow.flatMap((item) => {
    const uniqueActiveUsers = new Map<string, true>()
    for (const member of item.approverGroup?.members ?? []) {
      if (!member.userId) continue
      if (member.user && member.user.status !== 'ATIVO') continue
      uniqueActiveUsers.set(member.userId, true)
    }
    return [...uniqueActiveUsers.keys()].map((userId) => ({
      versionId: input.versionId,
      flowItemId: item.id,
      userId,
      stepType: item.stepType,
      order: item.order,
      roundNumber,
      policy: 'CURRENT_AND_HISTORICAL' as const,
    }))
  })
  if (!rows.length) return { created: 0, roundNumber }
  await tx.documentSourceApproverSnapshot.createMany({ data: rows, skipDuplicates: true })
  return { created: rows.length, roundNumber }
}
