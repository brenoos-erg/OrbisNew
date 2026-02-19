import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/site-url'
import { createEnvelopeFromPdfBuffer } from '@/lib/signature/providers/docusign/envelopes'
import { createRecipientView } from '@/lib/signature/providers/docusign/recipientView'
import { generateAndUploadTermoResponsabilidadePdf } from '@/lib/documents/termoResponsabilidade'

type CreateEmbeddedSigningForAssignmentInput = {
  assignmentId: string
  signerName: string
  signerEmail: string
  fileName: string
  vistoriaObservacoes?: string
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
      document: { select: { id: true, type: true, pdfUrl: true, title: true } },
    },
  })

  if (!assignment) {
    throw new Error('Atribuição de documento não encontrada para assinatura.')
  }

  const returnUrl = assignment.signingReturnUrl || `${getSiteUrl()}/dashboard/meus-documentos/return?assignmentId=${assignment.id}`
  const clientUserId = assignment.userId

  let envelopeId = assignment.signingExternalId

  let pdfSourceUrl = assignment.document.pdfUrl

  if (assignment.document.type === 'TERMO_RESPONSABILIDADE' && input.vistoriaObservacoes?.trim()) {
    const regenerated = await generateAndUploadTermoResponsabilidadePdf({
      assignmentId: assignment.id,
      documentId: assignment.document.id,
      vistoriaObservacoes: input.vistoriaObservacoes,
    })

    await prisma.document.update({
      where: { id: assignment.document.id },
      data: { pdfUrl: regenerated.url },
    })
    pdfSourceUrl = regenerated.url

    await prisma.documentAssignment.update({
      where: { id: assignment.id },
      data: {
        vistoriaObservacoes: input.vistoriaObservacoes.trim(),
        signingUrl: null,
        signingExternalId: null,
      },
    })

    envelopeId = null
  }

  if (!envelopeId) {
    if (!pdfSourceUrl) {
      throw new Error('Documento sem PDF disponível para iniciar assinatura DocuSign.')
    }

    const pdfBuffer = await downloadPdfBuffer(pdfSourceUrl)

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