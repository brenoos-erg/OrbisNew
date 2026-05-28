import { mkdir, appendFile } from 'fs/promises'
import path from 'path'

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'token',
  'authorization',
  'cookie',
  'accesstoken',
  'refreshtoken',
  'secret',
])

const LOG_DIRECTORY = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIRECTORY, 'error-registry.jsonl')

export type RegisterAppErrorInput = {
  area: string
  route: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT' | string
  userId?: string | null
  userLogin?: string | null
  message?: string
  error?: unknown
  statusCode?: number
  requestId?: string | null
  metadata?: Record<string, unknown>
}

type JsonSafeValue = string | number | boolean | null | JsonSafeValue[] | { [key: string]: JsonSafeValue }

function shouldIncludeStack() {
  return process.env.NODE_ENV !== 'production' || process.env.ERROR_REGISTRY_INCLUDE_STACK === 'true'
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}

function sanitizeValue(value: unknown, seen = new WeakSet<object>()): JsonSafeValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) {
    return { name: value.name, message: value.message }
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, seen))
      .filter((item): item is JsonSafeValue => item !== undefined)
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)

    const sanitized: { [key: string]: JsonSafeValue } = {}
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue
      const sanitizedValue = sanitizeValue(nestedValue, seen)
      if (sanitizedValue !== undefined) sanitized[key] = sanitizedValue
    }
    seen.delete(value)
    return sanitized
  }

  return String(value)
}

function errorMessage(input: RegisterAppErrorInput) {
  if (input.message) return input.message
  if (input.error instanceof Error) return input.error.message
  if (typeof input.error === 'string') return input.error
  return 'Erro inesperado na API.'
}

function errorStack(error: unknown) {
  if (!shouldIncludeStack()) return undefined
  return error instanceof Error ? error.stack : undefined
}

export async function registerAppError(input: RegisterAppErrorInput) {
  try {
    const stack = errorStack(input.error)
    const metadata = input.metadata ? sanitizeValue(input.metadata) : undefined
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'error' as const,
      area: input.area,
      route: input.route,
      method: input.method,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userLogin ? { userLogin: input.userLogin } : {}),
      message: errorMessage(input),
      ...(stack ? { stack } : {}),
      ...(input.statusCode ? { statusCode: input.statusCode } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { metadata } : {}),
    }

    await mkdir(LOG_DIRECTORY, { recursive: true })
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch (loggingError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[errorRegistry] Falha ao registrar erro da aplicação', loggingError)
    }
  }
}
