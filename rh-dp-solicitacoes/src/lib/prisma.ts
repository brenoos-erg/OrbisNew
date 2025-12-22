// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { recordPrismaQuery } from '@/lib/request-metrics'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL
const isProd = process.env.NODE_ENV === 'production'

// Preferimos a string de pool (DATABASE_URL). Em produção, cair para a URL direta
// evita que o app quebre por falta de configuração, mas mostramos um alerta bem
// explícito para ajustar no Vercel.
if (!process.env.DATABASE_URL && directDatabaseUrl) {
  process.env.DATABASE_URL = directDatabaseUrl

  if (isProd) {
    console.warn(
      '[prisma] DATABASE_URL ausente em produção; usando DIRECT_DATABASE_URL como fallback. ' +
        'Configure DATABASE_URL com a URL do pool (aws-*-pooler.supabase.net) para evitar erros de conexão.',
    )
  } else if (process.env.PRISMA_CLIENT_USE_DIRECT_URL !== 'false') {
    console.info('[prisma] Usando DIRECT_DATABASE_URL no ambiente de desenvolvimento.')
  }

}
// Somente em dev mantemos a opção de forçar o uso da directUrl (útil para migrações locais)
const shouldUseDirectUrl =
  process.env.NODE_ENV !== 'production' &&
  directDatabaseUrl &&
  process.env.PRISMA_CLIENT_USE_DIRECT_URL !== 'false'


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
    log: enableQueryMetrics
      ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }]
      : [{ emit: 'stdout', level: 'error' }],
  })

if (enableQueryMetrics && !globalForPrisma.prisma) {
  // cast aqui só para satisfazer o TS quando ele tipa $on como "never"
  ;(prisma as any).$on('query', (event: PrismaQueryEvent) => {
    recordPrismaQuery(event.duration)

    if (event.duration > 200) {
      console.info('[prisma][slow-query]', {
        durationMs: event.duration,
        target: event.target,
      })
    }
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}