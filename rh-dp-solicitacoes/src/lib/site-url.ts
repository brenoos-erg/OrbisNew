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

export function getSiteUrl() {
  let url = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || '')

  if (!url) {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || ''
    const vercelWithProtocol = vercelUrl ? (vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`) : ''
    url = normalizeUrl(vercelWithProtocol)
  }
if (process.env.NODE_ENV === 'production' && looksLocalhost(url)) {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || ''
    const vercelWithProtocol = vercelUrl ? (vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`) : ''
    const normalizedVercel = normalizeUrl(vercelWithProtocol)
    if (normalizedVercel && !looksLocalhost(normalizedVercel)) {
      console.warn('Ignoring localhost NEXT_PUBLIC_SITE_URL in production; using Vercel domain instead.')
      url = normalizedVercel
    }
  }

  if (!url && typeof window !== 'undefined') {
    url = normalizeUrl(window.location.origin)
  }

  if (!url && process.env.NODE_ENV === 'production' && !warnedMissingSiteUrl) {
    console.warn('NEXT_PUBLIC_SITE_URL não configurada. Defina esta variável no Vercel.')
    warnedMissingSiteUrl = true
  }

  return url
}