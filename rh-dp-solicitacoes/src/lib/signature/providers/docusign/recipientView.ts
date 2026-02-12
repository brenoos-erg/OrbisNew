import { getDocuSignAccessToken } from './auth'
import { getDocuSignConfig } from './config'

type CreateRecipientViewInput = {
  envelopeId: string
  signerName: string
  signerEmail: string
  clientUserId: string
  returnUrl: string
}

export async function createRecipientView(input: CreateRecipientViewInput) {
  const config = getDocuSignConfig()
  const accessToken = await getDocuSignAccessToken()

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${input.envelopeId}/views/recipient`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        returnUrl: input.returnUrl,
        authenticationMethod: 'none',
        email: input.signerEmail,
        userName: input.signerName,
        clientUserId: input.clientUserId,
      }),
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao criar recipient view (${response.status}): ${text}`)
  }

  const json = (await response.json()) as { url: string }
  return { url: json.url }
}