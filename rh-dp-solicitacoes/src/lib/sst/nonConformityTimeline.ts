import { Prisma } from '@prisma/client'

type TimelineClient = {
  nonConformityTimeline: {
    create: (args: Prisma.NonConformityTimelineCreateArgs) => Promise<unknown>
  }
}

export function isNonConformityTimelineTableMissing(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== 'P2021') return false
  const targetTable = String((error.meta as Record<string, unknown> | undefined)?.table ?? '').toLowerCase()
  return targetTable.includes('nonconformitytimeline')
}

export async function appendNonConformityTimelineEvent(
  client: TimelineClient,
  data: Prisma.NonConformityTimelineUncheckedCreateInput,
): Promise<void> {
  try {
    await client.nonConformityTimeline.create({ data })
  } catch (error) {
    if (!isNonConformityTimelineTableMissing(error)) {
      throw error
    }

    console.warn('Skipping non-conformity timeline event because table NonConformityTimeline is missing.')
  }
}