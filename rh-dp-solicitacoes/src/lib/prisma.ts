// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { recordPrismaQuery } from '@/lib/request-metrics'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isProd = process.env.NODE_ENV === 'production'

// Remove espaços/quebras de linha acidentais das variáveis de ambiente
const cleanEnvUrl = (value?: string | null) => value?.trim() || null

const directDatabaseUrl =
  cleanEnvUrl(process.env.DIRECT_DATABASE_URL) || cleanEnvUrl(process.env.DIRECT_URL)
const poolDatabaseUrl =
  cleanEnvUrl(process.env.DATABASE_URL) ||
  cleanEnvUrl(process.env.SUPABASE_PRISMA_URL) ||
  cleanEnvUrl(process.env.SUPABASE_POOLER_URL) ||
  null
  const warnMissingPoolerParams = (urlValue?: string | null) => {
  if (!urlValue) return
  try {
    const parsedUrl = new URL(urlValue)
    const params = parsedUrl.searchParams
    const missing: string[] = []

    if (params.get('pgbouncer') !== 'true') {
      missing.push('pgbouncer=true')
    }
    if (params.get('sslmode') !== 'require') {
      missing.push('sslmode=require')
    }

    if (missing.length > 0) {
      console.warn('[prisma] DATABASE_URL sem parâmetros recomendados', {
        missing: missing.join(', '),
      })
    }
  } catch (error) {
    console.warn('[prisma] DATABASE_URL inválida, não foi possível validar parâmetros.', {
      error,
    })
  }
}

warnMissingPoolerParams(cleanEnvUrl(process.env.DATABASE_URL))

// ✅ Em produção, EXIGIR pooler
if (isProd && !poolDatabaseUrl) {
  throw new Error(
    'DATABASE_URL (pooler) não configurada em produção. Configure DATABASE_URL/SUPABASE_PRISMA_URL/SUPABASE_POOLER_URL no Vercel.',
  )
}

// ✅ Em dev, pode usar direct (se permitido)
const shouldUseDirectUrl =
  !isProd && !!directDatabaseUrl && process.env.PRISMA_CLIENT_USE_DIRECT_URL !== 'false'

const resolvedDatabaseUrl =
  shouldUseDirectUrl ? directDatabaseUrl : poolDatabaseUrl ?? directDatabaseUrl

if (!resolvedDatabaseUrl) {
  throw new Error('Nenhuma URL de banco encontrada (DATABASE_URL/DIRECT_DATABASE_URL).')
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
    datasources: { db: { url: resolvedDatabaseUrl } },
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

// ✅ Cachear sempre (inclusive prod)
globalForPrisma.prisma = prisma
