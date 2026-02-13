import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/site-url'
import { createEnvelopeFromPdfBuffer } from '@/lib/signature/providers/docusign/envelopes'
import { createRecipientView } from '@/lib/signature/providers/docusign/recipientView'

type CreateEmbeddedSigningForAssignmentInput = {
  assignmentId: string
  signerName: string
  signerEmail: string
  fileName: string
}

async function downloadPdfBuffer(url: string) {
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Falha ao baixar PDF do documento (${response.status}): ${text}`)
  }

  const arr = await response.arrayBuffer()
  return Buffer.from(arr)
}

export async function createEmbeddedSigningForAssignment(input: CreateEmbeddedSigningForAssignmentInput) {
  const assignment = await prisma.documentAssignment.findUnique({
    where: { id: input.assignmentId },
    include: {
      document: { select: { pdfUrl: true, title: true } },
    },
  })

  if (!assignment) {
    throw new Error('Atribuição de documento não encontrada para assinatura.')
  }

  const returnUrl = assignment.signingReturnUrl || `${getSiteUrl()}/meus-documentos`
  const clientUserId = assignment.userId

  let envelopeId = assignment.signingExternalId

  if (!envelopeId) {
    const pdfBuffer = await downloadPdfBuffer(assignment.document.pdfUrl)

    const envelope = await createEnvelopeFromPdfBuffer({
      pdfBuffer,
      filename: input.fileName || assignment.document.title,
      emailSubject: `Assinatura de documento: ${assignment.document.title}`,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      clientUserId,
    })

    envelopeId = envelope.envelopeId

    await prisma.documentAssignment.update({
      where: { id: assignment.id },
      data: {
        signingProvider: 'DOCUSIGN',
        signingExternalId: envelopeId,
        signingReturnUrl: returnUrl,
        status: 'AGUARDANDO_ASSINATURA',
      },
    })
  }

  const recipient = await createRecipientView({
    envelopeId,
    signerName: input.signerName,
    signerEmail: input.signerEmail,
    clientUserId,
    returnUrl,
  })

  await prisma.documentAssignment.update({
    where: { id: assignment.id },
    data: {
      signingProvider: 'DOCUSIGN',
      signingUrl: recipient.url,
      signingReturnUrl: returnUrl,
      status: 'AGUARDANDO_ASSINATURA',
    },
  })

  return {
    assignmentId: assignment.id,
    envelopeId,
    signingUrl: recipient.url,
  }
}