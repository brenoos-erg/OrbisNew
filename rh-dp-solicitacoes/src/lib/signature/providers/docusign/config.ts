type DocuSignConfig = {
  basePath: string
  accountId: string
  clientId: string
  userId: string
  privateKey: string
  oauthBasePath: string
  webhookSecret: string
  appBaseUrl: string
}

function getEnv(name: string, required = true) {
  const value = process.env[name]?.trim()
  if (!value && required) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`)
  }
  return value || ''
}

export function getDocuSignConfig(): DocuSignConfig {
  const privateKey = getEnv('DOCUSIGN_PRIVATE_KEY').replace(/\\n/g, '\n')

  return {
    basePath: getEnv('DOCUSIGN_BASE_PATH').replace(/\/$/, ''),
    accountId: getEnv('DOCUSIGN_ACCOUNT_ID'),
    clientId: getEnv('DOCUSIGN_CLIENT_ID'),
    userId: getEnv('DOCUSIGN_USER_ID'),
    privateKey,
    oauthBasePath: getEnv('DOCUSIGN_OAUTH_BASE_PATH'),
    webhookSecret:
      process.env.DOCUSIGN_CONNECT_HMAC_SECRET?.trim() ||
      process.env.DOCUSIGN_WEBHOOK_SECRET?.trim() ||
      '',
    appBaseUrl: getEnv('APP_BASE_URL'),
  }
}