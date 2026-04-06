import { PrintCopyType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

import { requireActiveUser } from '@/lib/auth'
import { registerDocumentAuditLog } from '@/lib/documentAudit'
import { executeControlledDocumentAction, type ControlledIntent } from '@/lib/documents/controlledAction'
import { buildControlledPdf } from '@/lib/documents/controlledPdfPipeline'
import { prisma } from '@/lib/prisma'

type Payload = { intent?: string }

function normalizeIntent(intent?: string): ControlledIntent | null {
  const value = String(intent ?? '').trim().toLowerCase()
  if (value === 'view' || value === 'download' || value === 'print') return value
  return null
}

async function registerActionLogs(params: {
  req: NextRequest
  intent: ControlledIntent
  userId: string
  documentId: string
  versionId: string
}) {
  const ip = params.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = params.req.headers.get('user-agent')

  if (params.intent === 'download') {
    await prisma.documentDownloadLog.create({
      data: {
        documentId: params.documentId,
        versionId: params.versionId,
        userId: params.userId,
        ip,
        userAgent,
      },
    })
  }

  if (params.intent === 'print') {
    await prisma.printCopy.create({
      data: {
        documentId: params.documentId,
        versionId: params.versionId,
        type: PrintCopyType.UNCONTROLLED,
        issuedById: params.userId,
      },
    })
  }

  await registerDocumentAuditLog({
    action: params.intent.toUpperCase() as 'VIEW' | 'DOWNLOAD' | 'PRINT',
    documentId: params.documentId,
    versionId: params.versionId,
    userId: params.userId,
    ip,
    userAgent,
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const action = normalizeIntent(req.nextUrl.searchParams.get('action') ?? undefined)

  if (!action) {
    return NextResponse.json({ error: 'Ação inválida. Use action=view, action=download ou action=print.' }, { status: 400 })
  }

  try {
    const resolved = await buildControlledPdf(versionId, me.id, action)
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    if ('termChallenge' in resolved) return NextResponse.json(resolved.termChallenge, { status: resolved.status })

    await registerActionLogs({
      req,
      intent: action,
      userId: me.id,
      documentId: resolved.access.documentId,
      versionId: resolved.access.versionId,
    })

    const disposition = action === 'download' ? 'attachment' : 'inline'
    const encodedOutputName = encodeURIComponent(resolved.outputFileName)

    return new NextResponse(new Uint8Array(resolved.outputBuffer), {
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedOutputName}`,
        'Cache-Control': 'private, max-age=0, no-cache',
        'X-Document-Copy-Type': resolved.controlledFlowApplied ? 'UNCONTROLLED' : 'ORIGINAL',
        'X-Document-Watermark': resolved.watermarkApplied ? 'CÓPIA CONTROLADA' : 'UNAVAILABLE',
      },
    })
  } catch (error) {
    console.error('Falha ao executar ação controlada de documento (GET).', { versionId, action, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final do documento.' }, { status: 422 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  const payload = (await req.json().catch(() => null)) as Payload | null
  const intent = normalizeIntent(payload?.intent)

  if (!intent) {
    return NextResponse.json({ error: 'Ação inválida. Use view, download ou print.' }, { status: 400 })
  }

  try {
    const result = await executeControlledDocumentAction({ req, versionId, userId: me.id, intent })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    if ('termChallenge' in result) return NextResponse.json(result.termChallenge, { status: result.status })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Falha ao executar ação no pipeline único de PDF controlado.', { versionId, intent, error })
    return NextResponse.json({ error: 'Não foi possível preparar o PDF final do documento.' }, { status: 422 })
  }
}