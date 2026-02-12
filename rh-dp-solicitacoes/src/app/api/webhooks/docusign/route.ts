export const dynamic = 'force-dynamic'
export const revalidate = 0

import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadCertificateOfCompletion } from '@/lib/signature/providers/docusign/envelopes'
import { uploadGeneratedFile } from '@/lib/storage/uploadGeneratedFile'
import { finalizeSolicitationIfNoPending } from '@/lib/signature/finalizeSolicitationIfNoPending'

function validateHmac(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader || !secret) {
    return false
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  return digest === signatureHeader
}

function parseEnvelopeStatus(payload: any) {
  const envelopeId =
    payload?.data?.envelopeId ||
    payload?.envelopeId ||
    payload?.envelopeSummary?.envelopeId ||
    payload?.DocuSignEnvelopeInformation?.EnvelopeStatus?.EnvelopeID

  const statusRaw =
    payload?.data?.envelopeSummary?.status ||
    payload?.status ||
    payload?.envelopeSummary?.status ||
    payload?.DocuSignEnvelopeInformation?.EnvelopeStatus?.Status

  return {
    envelopeId: envelopeId ? String(envelopeId) : '',
    status: statusRaw ? String(statusRaw).toLowerCase() : '',
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signatureHeader = req.headers.get('x-docusign-signature-1')
    const secret = process.env.DOCUSIGN_CONNECT_HMAC_SECRET || ''

    if (secret && !validateHmac(rawBody, signatureHeader, secret)) {
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody || '{}')
    const { envelopeId, status } = parseEnvelopeStatus(payload)

    if (!envelopeId) {
      return NextResponse.json({ error: 'Envelope ID ausente no evento.' }, { status: 400 })
    }

    const assignment = await prisma.documentAssignment.findFirst({
      where: { signingExternalId: envelopeId },
      include: { document: { select: { solicitationId: true } } },
    })

    if (!assignment) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    if (status === 'completed') {
      const certificate = await downloadCertificateOfCompletion(envelopeId)
      const certFile = `docusign-certificate-${assignment.id}-${Date.now()}.pdf`
      const uploaded = await uploadGeneratedFile({
        fileName: certFile,
        buffer: certificate,
        contentType: 'application/pdf',
      })

      const auditHash = crypto.createHash('sha256').update(certificate).digest('hex')

      await prisma.$transaction(async (tx) => {
        await tx.documentAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'ASSINADO',
            signedAt: new Date(),
            auditTrailUrl: uploaded.url,
            auditTrailHash: auditHash,
          },
        })

        if (assignment.document.solicitationId) {
          await finalizeSolicitationIfNoPending(tx, assignment.document.solicitationId, 'webhook-docusign')
        }
      })
    }

    if (status === 'declined' || status === 'voided') {
      await prisma.documentAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'RECUSADO',
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao processar webhook DocuSign', error)
    return NextResponse.json({ error: 'Erro ao processar webhook DocuSign.' }, { status: 500 })
  }
}