let warnedMissingSiteUrl = false

function normalizeUrl(url: string) {
  if (!url) return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

export function getSiteUrl() {
  let url = process.env.NEXT_PUBLIC_SITE_URL || ''

  if (!url) {
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || ''
    if (vercelUrl) {
      url = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`
    }
  }

  if (!url && typeof window !== 'undefined') {
    url = window.location.origin
  }

  const normalized = normalizeUrl(url)

  if (!normalized && process.env.NODE_ENV === 'production' && !warnedMissingSiteUrl) {
    console.warn('NEXT_PUBLIC_SITE_URL não configurada. Defina esta variável no Vercel.')
    warnedMissingSiteUrl = true
  }

  return normalized
}