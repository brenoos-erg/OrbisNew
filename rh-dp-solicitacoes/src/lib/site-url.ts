let warnedMissingSiteUrl = false

function normalizeUrl(url: string) {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function looksLocalhost(url: string) {
  return /(^|\b)(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)
}
function normalizeVercelUrl() {
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL || ''
  const vercelWithProtocol = vercelUrl ? (vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`) : ''
  return normalizeUrl(vercelWithProtocol)
}

const DEV_FALLBACK = 'http://localhost:3000'

type ResolveOptions = {
  allowLocalhostInProduction?: boolean
  context?: string
}

export function getSiteUrl() {
  let url = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || '')
  const vercelUrl = normalizeVercelUrl()

  if (!url) {
    url = vercelUrl
  }

  if (!url && typeof window !== 'undefined') {
    url = normalizeUrl(window.location.origin)
  }
  if (!url && process.env.NODE_ENV !== 'production') {
    url = DEV_FALLBACK
  }

  if (process.env.NODE_ENV === 'production' && looksLocalhost(url)) {
    if (vercelUrl && !looksLocalhost(vercelUrl)) {
      console.warn('Ignoring localhost NEXT_PUBLIC_SITE_URL in production; using Vercel domain instead.')
      url = vercelUrl
    } else {
      console.warn('Ignoring localhost NEXT_PUBLIC_SITE_URL in production; no safe alternative available.')
      url = ''
    }
  }

   if (!url && process.env.NODE_ENV === 'production' && !warnedMissingSiteUrl) {
    console.warn('NEXT_PUBLIC_SITE_URL não configurada. Defina esta variável no Vercel.')
    warnedMissingSiteUrl = true
  }

  return url
}

export function resolveAppBaseUrl(options?: ResolveOptions) {
  const context = options?.context ?? 'general'
  const allowLocalhostInProduction = options?.allowLocalhostInProduction ?? false

  const candidates = [
    normalizeUrl(process.env.APP_BASE_URL || ''),
    normalizeUrl(process.env.APP_URL || ''),
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL || ''),
    getSiteUrl(),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (process.env.NODE_ENV === 'production' && looksLocalhost(candidate) && !allowLocalhostInProduction) {
      console.error(`[${context}] URL base inválida em produção (localhost ignorado).`, { candidate })
      continue
    }

    return candidate
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_FALLBACK
  }

  console.error(`[${context}] URL base não configurada em produção. Defina APP_BASE_URL, APP_URL, NEXT_PUBLIC_APP_URL ou NEXT_PUBLIC_SITE_URL.`)
  return ''
}