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

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
])
const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']

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

function normalizeUploadedFileName(fileName: string) {
  return fileName.replace(/\s+/g, ' ').replace(/[\r\n]+/g, ' ').trim()
}

function isSupportedUpload(file: File) {
  const lowerName = file.name.toLowerCase()
  const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true
  return hasValidExtension
}

function isWordDocument(file: File) {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.doc') || lower.endsWith('.docx')
}

function buildPublicAttachmentUrl(token: string, attachmentId: string, disposition: 'inline' | 'attachment') {
  return `/api/solicitacoes/externas/admissao/public/${token}/attachments/${attachmentId}?disposition=${disposition}`
}

async function persistUploadedFile(file: File, targetFileName: string) {
  const lowerOriginalName = normalizeUploadedFileName(file.name).toLowerCase()
  const bytes = Buffer.from(await file.arrayBuffer())

  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('Arquivo excede o tamanho máximo permitido de 10MB.')
  }

  const isPdf = file.type === 'application/pdf' || lowerOriginalName.endsWith('.pdf')
  const isWord = isWordDocument(file)
  const isImage =
    file.type === 'image/png' || file.type === 'image/jpeg' || lowerOriginalName.endsWith('.png') || lowerOriginalName.endsWith('.jpg') || lowerOriginalName.endsWith('.jpeg')

  if (!isPdf && !isWord && !isImage) {
    throw new Error('Formato não suportado. Envie PDF, JPG, PNG, DOC ou DOCX.')
  }

  if (isWord) {
    const relPath = `/uploads/solicitacoes/${randomUUID()}-${targetFileName}`
    const absPath = path.join(process.cwd(), 'public', relPath)
    await mkdir(path.dirname(absPath), { recursive: true })

    const tempDir = path.join(os.tmpdir(), `admission-${randomUUID()}`)
    await mkdir(tempDir, { recursive: true })
    const sourceAbsolutePath = path.join(tempDir, file.name)
    await writeFile(sourceAbsolutePath, bytes)
    const converted = await convertWordToPdf({ fileUrl: file.name, sourceAbsolutePath })
    const pdfBuffer = converted.pdfBuffer
    await writeFile(absPath, pdfBuffer)
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return { relPath, size: pdfBuffer.length, mimeType: 'application/pdf', filename: targetFileName }
  }

  const extension = isImage ? path.extname(lowerOriginalName) || '.png' : '.pdf'
  const filename = isPdf ? targetFileName : targetFileName.replace(/\.pdf$/i, extension)
  const relPath = `/uploads/solicitacoes/${randomUUID()}-${filename}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, bytes)

  return {
    relPath,
    size: bytes.length,
    mimeType: isImage ? (extension === '.png' ? 'image/png' : 'image/jpeg') : 'application/pdf',
    filename,
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const solicitation = await findSolicitationByToken(token)

  if (!solicitation) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  }

  const admission = getAdmissionPayload(solicitation.payload)
  const checklistStatus = (admission.checklistStatus ?? {}) as Record<string, boolean>
  const checklist = Array.isArray(admission.checklist) ? admission.checklist : EXTERNAL_ADMISSION_CHECKLIST
  const submissions = (admission.submissions ?? {}) as Record<string, string[]>

  const attachmentMap = new Map(solicitation.anexos.map((attachment: any) => [attachment.id, attachment]))

  const items = checklist.map((item: any) => {
    const attachmentIds = Array.isArray(submissions[item.key]) ? submissions[item.key] : []
    const files = attachmentIds
      .map((attachmentId: string) => {
        const attachment = attachmentMap.get(attachmentId) as any
        if (!attachment) return null
        return {
          id: attachment.id as string,
          filename: attachment.filename as string,
          sizeBytes: attachment.sizeBytes as number,
          mimeType: attachment.mimeType as string,
          createdAt: attachment.createdAt as string,
          previewUrl: buildPublicAttachmentUrl(token, attachment.id as string, 'inline'),
          downloadUrl: buildPublicAttachmentUrl(token, attachment.id as string, 'attachment'),
        }
      })
      .filter((file): file is {
        id: string
        filename: string
        sizeBytes: number
        mimeType: string
        createdAt: string
        previewUrl: string
        downloadUrl: string
      } => Boolean(file))

    return {
      ...item,
      status: files.length > 0 || checklistStatus[item.key] ? 'ENVIADO' : 'PENDENTE',
      files,
    }
  })

  const requiredCount = checklist.filter((item: any) => item.required).length
  const requiredDone = checklist.filter((item: any) => item.required && checklistStatus[item.key]).length

  return NextResponse.json({
    solicitationId: solicitation.id,
    protocolo: solicitation.protocolo,
    status: admission.status ?? EXTERNAL_ADMISSION_STATUS.WAITING,
    candidateName: admission.candidateName ?? '',
    checklist: items,
    checklistStatus,
    filesByItem: submissions,
    requiredCount,
    requiredDone,
    canConclude: isAllRequiredChecklistDone(checklistStatus),
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    allowedTypes: ['PDF', 'JPG', 'PNG', 'DOC', 'DOCX'],
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

  if (!isSupportedUpload(file)) {
    return NextResponse.json({ error: 'Formato inválido. Envie PDF, JPG, PNG, DOC ou DOCX.' }, { status: 400 })
  }

  const item = resolveChecklistItem(itemKey)
  if (!item) {
    return NextResponse.json({ error: 'Item de checklist inválido.' }, { status: 400 })
  }

  const admission = getAdmissionPayload(solicitation.payload)
  const submissions = { ...(admission.submissions ?? {}) } as Record<string, string[]>
  const currentFiles = submissions[itemKey] ?? []

  if (item.maxFiles && currentFiles.length >= item.maxFiles) {
    return NextResponse.json({ error: `Este item permite no máximo ${item.maxFiles} arquivo(s).` }, { status: 400 })
  }

  const rawFileName = humanFileNameForChecklistItem(item.label, admission.candidateName ?? 'CANDIDATO', currentFiles.length)

  let stored: Awaited<ReturnType<typeof persistUploadedFile>>
  try {
    stored = await persistUploadedFile(file, rawFileName)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar arquivo.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const attachment = await prisma.attachment.create({
    data: {
      id: randomUUID(),
      solicitationId: solicitation.id,
      filename: stored.filename,
      url: stored.relPath,
      mimeType: stored.mimeType,
      sizeBytes: stored.size,
    },
    select: { id: true, createdAt: true, filename: true, sizeBytes: true, mimeType: true },
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

  return NextResponse.json({
    ok: true,
    itemKey,
    file: {
      ...attachment,
      previewUrl: buildPublicAttachmentUrl(token, attachment.id, 'inline'),
      downloadUrl: buildPublicAttachmentUrl(token, attachment.id, 'attachment'),
    },
  })
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
    const requiredPending = EXTERNAL_ADMISSION_CHECKLIST.filter((item) => item.required && !checklistStatus[item.key]).map((item) => item.label)
    return NextResponse.json(
      {
        error: 'Envie todos os itens obrigatórios antes de concluir.',
        requiredPending,
      },
      { status: 400 },
    )
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
