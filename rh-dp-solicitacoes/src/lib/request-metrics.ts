// src/lib/request-metrics.ts
import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

export type MetricsContext = {
  label: string
  startedAt: number
  prismaQueryCount: number
  prismaQueryTime: number
  cache: Map<string, Promise<unknown>>
}

const storage = new AsyncLocalStorage<MetricsContext>()
const endpointStats = new Map<string, { count: number; total: number; last: number }>()
let requestCounter = 0

function logTopSlowEndpoints() {
  if (requestCounter % 5 !== 0) return

  const sorted = [...endpointStats.entries()]
    .map(([label, value]) => ({
      label,
      avg: value.total / Math.max(1, value.count),
      last: value.last,
      count: value.count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  if (sorted.length === 0) return

  console.info('[metrics] Top endpoints (avg ms)', sorted)
}

function registerEndpointStat(label: string, totalMs: number) {
  const current = endpointStats.get(label) ?? { count: 0, total: 0, last: 0 }
  current.count += 1
  current.total += totalMs
  current.last = totalMs
  endpointStats.set(label, current)
  requestCounter += 1
  logTopSlowEndpoints()
}

export function recordPrismaQuery(durationMs: number) {
  const ctx = storage.getStore()
  if (!ctx) return
  ctx.prismaQueryCount += 1
  ctx.prismaQueryTime += durationMs
}

export async function withRequestMetrics<T>(
  label: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const existing = storage.getStore()
  if (existing) {
    return fn()
  }

  const context: MetricsContext = {
    label,
    startedAt: performance.now(),
    prismaQueryCount: 0,
    prismaQueryTime: 0,
    cache: new Map(),
  }

  return storage.run(context, async () => {
    try {
      return await fn()
    } finally {
      const totalMs = performance.now() - context.startedAt
      registerEndpointStat(label, totalMs)
      console.info('[metrics] request', {
        label,
        totalMs: Number(totalMs.toFixed(1)),
        prismaQueries: context.prismaQueryCount,
        prismaQueryTimeMs: Number(context.prismaQueryTime.toFixed(1)),
      })
    }
  })
}

export function logTiming(label: string, startedAt: number) {
  const elapsed = performance.now() - startedAt
  console.info('[timing]', label, `${elapsed.toFixed(1)}ms`)
}

export async function memoizeRequest<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const ctx = storage.getStore()

  if (!ctx) {
    return fn()
  }

  const existing = ctx.cache.get(key)
  if (existing) {
    return (await existing) as T
  }

  const pending = Promise.resolve(fn())
  ctx.cache.set(key, pending)
  return pending
}
