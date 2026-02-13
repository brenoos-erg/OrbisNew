import jwt from 'jsonwebtoken'
import { getDocuSignConfig } from './config'

type CachedToken = {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null
function buildDocuSignAuthErrorMessage(params: {
  status: number
  bodyText: string
  oauthBasePath: string
  clientId: string
}) {
  const { status, bodyText, oauthBasePath, clientId } = params
  let details = bodyText

  try {
    const parsed = JSON.parse(bodyText) as { error?: string; error_description?: string }
    if (parsed.error === 'invalid_grant' && parsed.error_description === 'issuer_not_found') {
      const environmentHint = oauthBasePath.includes('account-d.docusign.com')
        ? 'demo/sandbox'
        : oauthBasePath.includes('account.docusign.com')
          ? 'produção'
          : `oauth base path configurado (${oauthBasePath})`

      details = [
        `${bodyText}`,
        '',
        'Diagnóstico provável: o `DOCUSIGN_CLIENT_ID` não foi encontrado nesse ambiente da DocuSign.',
        `- client_id atual: ${clientId}`,
        `- ambiente inferido: ${environmentHint}`,
        '- Verifique se a Integration Key existe no mesmo ambiente configurado em `DOCUSIGN_OAUTH_BASE_PATH`.',
        '- Se estiver em sandbox, confirme `DOCUSIGN_OAUTH_BASE_PATH=account-d.docusign.com`.',
        '- Se estiver em produção, confirme `DOCUSIGN_OAUTH_BASE_PATH=account.docusign.com`.',
      ].join('\n')
    }
  } catch {
    // Mantém a mensagem original quando o corpo não é JSON.
  }

  return `Falha ao autenticar no DocuSign (${status}): ${details}`
}

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
     throw new Error(
      buildDocuSignAuthErrorMessage({
        status: response.status,
        bodyText: text,
        oauthBasePath: config.oauthBasePath,
        clientId: config.clientId,
      }),
    )
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  }

  return json.access_token
}