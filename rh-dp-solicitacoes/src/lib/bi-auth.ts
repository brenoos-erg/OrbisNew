import { timingSafeEqual } from 'node:crypto'
import { NextRequest } from 'next/server'

function normalizeApiKeyHeaderValue(raw: string | null) {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseConfiguredBiApiKeys() {
  const raw = process.env.BI_API_KEYS ?? process.env.BI_API_KEY
  if (!raw) return []

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

function extractApiKeyFromRequest(req: NextRequest) {
  const xApiKey = normalizeApiKeyHeaderValue(req.headers.get('x-api-key'))
  if (xApiKey) return xApiKey

  const authorization = normalizeApiKeyHeaderValue(req.headers.get('authorization'))
  if (!authorization) return null

  const [scheme, credential] = authorization.split(/\s+/, 2)
  if (!scheme || !credential) return null

  if (scheme.toLowerCase() !== 'bearer') return null
  return credential.trim() || null
}

export function isBiRequestAuthorized(req: NextRequest) {
  const configuredKeys = parseConfiguredBiApiKeys()
  if (configuredKeys.length === 0) {
    return { ok: false, reason: 'missing_server_key' as const }
  }

  const requestKey = extractApiKeyFromRequest(req)
  if (!requestKey) {
    return { ok: false, reason: 'missing_request_key' as const }
  }

  const match = configuredKeys.some((key) => safeCompare(key, requestKey))
  if (!match) {
    return { ok: false, reason: 'invalid_key' as const }
  }

  return { ok: true as const }
}