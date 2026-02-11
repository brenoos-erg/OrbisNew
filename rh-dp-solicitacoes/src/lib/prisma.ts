// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { recordPrismaQuery } from '@/lib/request-metrics'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const cleanEnvUrl = (value?: string | null) => value?.trim() || null
const databaseUrl = cleanEnvUrl(process.env.DATABASE_URL)

if (!databaseUrl) {
  throw new Error('Nenhuma URL de banco encontrada (DATABASE_URL).')
}

const enableQueryMetrics =
  process.env.NODE_ENV === 'development' || process.env.PRISMA_QUERY_METRICS === '1'

type PrismaQueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: enableQueryMetrics
      ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }]
      : [{ emit: 'stdout', level: 'error' }],
  })

if (enableQueryMetrics && !globalForPrisma.prisma) {
  ;(prisma as any).$on('query', (event: PrismaQueryEvent) => {
    recordPrismaQuery(event.duration)
    if (event.duration > 200) {
      console.info('[prisma][slow-query]', { durationMs: event.duration, target: event.target })
    }
  })
}

globalForPrisma.prisma = prisma
