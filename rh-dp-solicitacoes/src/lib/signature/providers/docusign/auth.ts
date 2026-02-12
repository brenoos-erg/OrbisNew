import jwt from 'jsonwebtoken'
import { getDocuSignConfig } from './config'

type CachedToken = {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

export async function getDocuSignAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const config = getDocuSignConfig()
  const aud = config.oauthBasePath.startsWith('http')
    ? new URL(config.oauthBasePath).host
    : config.oauthBasePath

  const assertion = jwt.sign(
    {
      iss: config.clientId,
      sub: config.userId,
      aud,
      scope: 'signature impersonation',
    },
    config.privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '1h',
    },
  )

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const tokenUrl = config.oauthBasePath.startsWith('http')
    ? `${config.oauthBasePath.replace(/\/$/, '')}/oauth/token`
    : `https://${config.oauthBasePath}/oauth/token`

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao autenticar no DocuSign (${response.status}): ${text}`)
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  }

  return json.access_token
}