import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { convertWordToPdf } from '@/lib/documents/wordToPdf'
import {
  EXTERNAL_ADMISSION_CHECKLIST,
  EXTERNAL_ADMISSION_STATUS,
  EXTERNAL_ADMISSION_TYPE_ID,
  humanFileNameForChecklistItem,
  isAllRequiredChecklistDone,
  resolveChecklistItem,
  toTokenHash,
} from '@/lib/externalAdmission'

async function findSolicitationByToken(token: string): Promise<any> {
  return prisma.solicitation.findFirst({
    where: {
      tipoId: EXTERNAL_ADMISSION_TYPE_ID,
      payload: {
        path: '$.externalAdmission.tokenHash',
        equals: toTokenHash(token),
      },
    },
    select: {
      id: true,
      protocolo: true,
      payload: true,
      status: true,
      anexos: {
        select: {
          id: true,
          filename: true,
          createdAt: true,
          sizeBytes: true,
          mimeType: true,
          url: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    } as any,
  })
}

function getAdmissionPayload(payload: any) {
  return (payload?.externalAdmission ?? {}) as Record<string, any>
}

async function persistPdfLike(file: File, targetFileName: string) {
  const relPath = `/uploads/solicitacoes/${randomUUID()}-${targetFileName}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })

  const bytes = Buffer.from(await file.arrayBuffer())
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  const isWord = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx')

  if (!isPdf && !isWord) {
    throw new Error('Formato não suportado. Envie PDF, DOC ou DOCX.')
  }

  if (isPdf) {
    await writeFile(absPath, bytes)
  } else {
    const tempDir = path.join(os.tmpdir(), `admission-${randomUUID()}`)
    await mkdir(tempDir, { recursive: true })
    const sourceAbsolutePath = path.join(tempDir, file.name)
    await writeFile(sourceAbsolutePath, bytes)
    const converted = await convertWordToPdf({ fileUrl: file.name, sourceAbsolutePath })
    const pdfBuffer = converted.pdfBuffer
    await writeFile(absPath, pdfBuffer)
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  return { relPath, size: bytes.length }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const solicitation = await findSolicitationByToken(token)

  if (!solicitation) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  }

  const admission = getAdmissionPayload(solicitation.payload)
  const checklistStatus = (admission.checklistStatus ?? {}) as Record<string, boolean>

  return NextResponse.json({
    solicitationId: solicitation.id,
    protocolo: solicitation.protocolo,
    status: admission.status ?? EXTERNAL_ADMISSION_STATUS.WAITING,
    candidateName: admission.candidateName ?? '',
    checklist: EXTERNAL_ADMISSION_CHECKLIST,
    checklistStatus,
    filesByItem: (admission.submissions ?? {}) as Record<string, string[]>,
    canConclude: isAllRequiredChecklistDone(checklistStatus),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const solicitation = await findSolicitationByToken(token)

  if (!solicitation) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  }

  const formData = await req.formData()
  const itemKey = String(formData.get('itemKey') ?? '').trim()
  const file = formData.get('file')

  if (!itemKey || !(file instanceof File)) {
    return NextResponse.json({ error: 'Item e arquivo são obrigatórios.' }, { status: 400 })
  }

  const item = resolveChecklistItem(itemKey)
  if (!item) {
    return NextResponse.json({ error: 'Item de checklist inválido.' }, { status: 400 })
  }

  const admission = getAdmissionPayload(solicitation.payload)
  const submissions = { ...(admission.submissions ?? {}) } as Record<string, string[]>
  const currentFiles = submissions[itemKey] ?? []

  const fileName = humanFileNameForChecklistItem(item.label, admission.candidateName ?? 'CANDIDATO', currentFiles.length)
  const stored = await persistPdfLike(file, fileName)

  const attachment = await prisma.attachment.create({
    data: {
      id: randomUUID(),
      solicitationId: solicitation.id,
      filename: fileName,
      url: stored.relPath,
      mimeType: 'application/pdf',
      sizeBytes: stored.size,
    },
    select: { id: true },
  })

  const nextItemFiles = [...currentFiles, attachment.id]
  const checklistStatus = {
    ...(admission.checklistStatus ?? {}),
    [itemKey]: nextItemFiles.length > 0,
  }

  submissions[itemKey] = nextItemFiles

  await prisma.solicitation.update({
    where: { id: solicitation.id },
    data: {
      payload: {
        ...(solicitation.payload as Record<string, unknown>),
        externalAdmission: {
          ...admission,
          checklistStatus,
          submissions,
          status: EXTERNAL_ADMISSION_STATUS.PENDING,
          lastCandidateSendAt: new Date().toISOString(),
        },
      },
    },
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const solicitation = await findSolicitationByToken(token)

  if (!solicitation) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  }

  const admission = getAdmissionPayload(solicitation.payload)
  const checklistStatus = (admission.checklistStatus ?? {}) as Record<string, boolean>

  if (!isAllRequiredChecklistDone(checklistStatus)) {
    return NextResponse.json({ error: 'Envie todos os itens obrigatórios antes de concluir.' }, { status: 400 })
  }

  await prisma.solicitation.update({
    where: { id: solicitation.id },
    data: {
      status: 'EM_ATENDIMENTO',
      payload: {
        ...(solicitation.payload as Record<string, unknown>),
        externalAdmission: {
          ...admission,
          status: EXTERNAL_ADMISSION_STATUS.SUBMITTED,
          completedAt: new Date().toISOString(),
        },
      },
    },
  })

  return NextResponse.json({ ok: true })
}
