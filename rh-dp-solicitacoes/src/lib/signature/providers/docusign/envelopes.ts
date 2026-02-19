import { getDocuSignAccessToken } from './auth'
import { getDocuSignConfig } from './config'

type CreateEnvelopeInput = {
  pdfBuffer: Buffer
  filename: string
  emailSubject: string
  signerName: string
  signerEmail: string
  clientUserId: string
}

async function docusignRequest<T>(path: string, init: RequestInit) {
  const config = getDocuSignConfig()
  const accessToken = await getDocuSignAccessToken()

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DocuSign request falhou (${response.status}) ${path}: ${text}`)
  }

  return (await response.json()) as T
}

export async function createEnvelopeFromPdfBuffer(input: CreateEnvelopeInput) {
  const payload = {
    emailSubject: input.emailSubject,
    documents: [
      {
        documentBase64: input.pdfBuffer.toString('base64'),
        name: input.filename,
        fileExtension: 'pdf',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: input.signerEmail,
          name: input.signerName,
          recipientId: '1',
          routingOrder: '1',
          clientUserId: input.clientUserId,
          tabs: {
            signHereTabs: [
              {
                anchorString: 'Assinatura eletrônica via DocuSign',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '18',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',
  }

  const result = await docusignRequest<{ envelopeId: string }>('/envelopes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return { envelopeId: result.envelopeId }
}

export async function downloadCertificateOfCompletion(envelopeId: string) {
  const config = getDocuSignConfig()
  const accessToken = await getDocuSignAccessToken()

  const docs = await docusignRequest<{ envelopeDocuments?: Array<{ documentId: string; name: string; type: string }> }>(
    `/envelopes/${envelopeId}/documents`,
    { method: 'GET' },
  )

  const certificate = docs.envelopeDocuments?.find((doc) => doc.type === 'summary' || /certificate/i.test(doc.name))

  if (!certificate?.documentId) {
    throw new Error(`Certificate of Completion não encontrado para envelope ${envelopeId}`)
  }

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/${certificate.documentId}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao baixar certificado (${response.status}): ${text}`)
  }

  const arr = await response.arrayBuffer()
  return Buffer.from(arr)
}

export async function downloadCombinedSignedDocument(envelopeId: string) {
  const config = getDocuSignConfig()
  const accessToken = await getDocuSignAccessToken()

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Falha ao baixar PDF assinado (${response.status}): ${text}`)
  }

  const arr = await response.arrayBuffer()
  return Buffer.from(arr)
}

