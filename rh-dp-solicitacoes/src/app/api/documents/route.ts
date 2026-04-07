import fs from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus, Prisma } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import {
  createSuccessMessageByStatus,
  duplicateCodeMessage,
  resolveInitialVersionStatus,
  routingForStatus,
} from '@/lib/iso-document-routing'
import { resolveInitialRevisionNumber } from '@/lib/isoDocumentCreation'
import { prisma } from '@/lib/prisma'
import { DocumentPublishPipelineError, finalizeToPublishedPdf } from '@/lib/documents/finalizeToPublishedPdf'
import { buildStoredDocumentFileName } from '@/lib/documents/documentStorage'
import { resolveDocumentFamilyRule } from '@/lib/documents/documentFamilyRules'

function normalizeCode(raw: unknown) {
  return String(raw ?? '').trim()
}
async function saveUploadedDocument(file: File, documentCode: string) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
  await fs.mkdir(uploadDir, { recursive: true })
  const extension = path.extname(file.name || '').toLowerCase() || '.bin'
  const safeName = buildStoredDocumentFileName(extension, 'doc')
  const absolute = path.join(uploadDir, safeName)
  const originalFileUrl = `/uploads/documents/${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(absolute, buffer)
  const familyRule = resolveDocumentFamilyRule(documentCode)
  const shouldFinalizeToPdf = familyRule.family === 'controlled-pdf'
  let savedFileUrl = originalFileUrl

  console.info('[documents.create] upload-flow-selected', {
    originalName: file.name,
    safeName,
    documentCode,
    prefix: familyRule.prefix,
    family: familyRule.family,
    shouldFinalizeToPdf,
  })

  if (shouldFinalizeToPdf) {
    savedFileUrl = await finalizeToPublishedPdf({ sourceFileUrl: originalFileUrl, documentCode })
  }

  onsole.info('[documents.create] upload-persisted', {
    originalName: file.name,
    safeName,
    family: familyRule.family,
    originalFileUrl,
    originalAbsolutePath: absolute,
    originalExists: true,
    savedFileUrl,
  })

  return savedFileUrl
}

export async function POST(req: NextRequest)   {
  let failureStage = 'request:start'
  try {
    failureStage = 'auth:require-active-user'
    const me = await requireActiveUser()

    failureStage = 'request:parse-content-type'
    const contentType = req.headers.get('content-type') ?? ''
    let payload: any = {}

    if (contentType.includes('multipart/form-data')) {
      failureStage = 'request:parse-form-data'
      const form = await req.formData()
      const uploadedFile = form.get('file') ?? form.get('pdf')
      const code = normalizeCode(form.get('code'))
      let fileUrl: string | null = null

      if (uploadedFile instanceof File && uploadedFile.size > 0) {
        failureStage = 'file:save-uploaded-document'
        fileUrl = await saveUploadedDocument(uploadedFile, code)
      }

      payload = {
        code,
        title: String(form.get('title') ?? ''),
        documentTypeId: String(form.get('documentTypeId') ?? ''),
        ownerCostCenterId: String(form.get('ownerCostCenterId') ?? ''),
        authorUserId: String(form.get('authorUserId') ?? '').trim(),
        summary: String(form.get('summary') ?? ''),
        affectedAreasNotes: String(form.get('affectedAreasNotes') ?? ''),
        fileUrl,
        revisionNumber: form.get('revisionNumber'),
      }
    } else {
       payload = await req.json()
      payload.code = normalizeCode(payload.code)
      payload.ownerCostCenterId = payload.ownerCostCenterId ?? ''
      payload.authorUserId = String(payload.authorUserId ?? '').trim()
    }

    console.info('[documents.create][debug] payload-received', {
      hasMultipart: contentType.includes('multipart/form-data'),
      code: payload.code ?? '',
      title: payload.title ?? '',
      documentTypeId: payload.documentTypeId ?? '',
      ownerCostCenterId: payload.ownerCostCenterId ?? '',
      authorUserId: payload.authorUserId || me.id,
      revisionNumber: payload.revisionNumber ?? null,
      hasFileUrl: Boolean(payload.fileUrl),
    })

    const authorUserId = payload.authorUserId || me.id

    failureStage = 'validation:required-fields'
    if (!payload.code || !payload.title || !payload.documentTypeId || !payload.ownerCostCenterId) {
      return NextResponse.json({ error: 'Preencha código, título, tipo de documento e centro responsável.' }, { status: 400 })
    }

    if (!payload.fileUrl) {
      return NextResponse.json({ error: 'Anexe um arquivo válido (PDF, DOC ou DOCX) para criar o documento.' }, { status: 400 })
    }

    failureStage = 'validation:document-type'
    const documentType = await prisma.documentTypeCatalog.findUnique({
      where: { id: String(payload.documentTypeId) },
      select: { id: true },
    })

    if (!documentType) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }

    failureStage = 'validation:cost-center'
    const ownerCostCenter = await prisma.costCenter.findUnique({
      where: { id: String(payload.ownerCostCenterId) },
      select: { id: true, departmentId: true },
    })
    if (!ownerCostCenter) {
      return NextResponse.json({ error: 'Centro responsável inválido.' }, { status: 400 })
    }

    failureStage = 'validation:author-user'
    const authorUser = await prisma.user.findUnique({
      where: { id: authorUserId },
      select: { id: true },
    })

    if (!authorUser) {
      return NextResponse.json({ error: 'Elaborador/Revisor inválido.' }, { status: 400 })
    }

    console.info('[documents.create] payload-file-url', {
      code: payload.code,
      title: payload.title,
      fileUrl: payload.fileUrl ?? null,
    })

    failureStage = 'document-type-flow:load'
    const flow = await prisma.documentTypeApprovalFlow.findMany({
      where: { documentTypeId: payload.documentTypeId, active: true },
      orderBy: { order: 'asc' },
      select: { id: true, stepType: true },
    })

    const initialStatus = resolveInitialVersionStatus(flow)
    const revisionNumber = resolveInitialRevisionNumber(payload.revisionNumber)

    failureStage = 'documents:check-duplicate-code'
    const existing = await prisma.isoDocument.findUnique({
      where: { code: payload.code },
      select: {
        id: true,
        versions: {
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
          select: { id: true, status: true },
        },
      },
    })

    if (existing?.versions[0]) {
      const status = existing.versions[0].status
      return NextResponse.json(
        {
          error: duplicateCodeMessage(payload.code, status),
          routing: routingForStatus(status),
        },
        { status: 409 },
      )
    }

   if (existing && existing.versions.length === 0) {
      failureStage = 'documents:recover-orphan-version'
      const recoveredVersion = await prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId: existing.id,
            revisionNumber,
            status: initialStatus,
            fileUrl: payload.fileUrl ?? null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            nextReviewAt: payload.nextReviewAt ? new Date(payload.nextReviewAt) : null,
            publishedAt: initialStatus === DocumentVersionStatus.PUBLICADO ? new Date() : null,
            isCurrentPublished: initialStatus === DocumentVersionStatus.PUBLICADO,
          },
        })
        if (flow.length > 0) {
          await tx.documentApproval.createMany({
            data: flow.map((item) => ({
              versionId: version.id,
              flowItemId: item.id,
              status: DocumentApprovalStatus.PENDING,
            })),
          })
        }

        return version
      })

      const routing = routingForStatus(initialStatus)
      return NextResponse.json(
        {
          id: existing.id,
          recoveredOrphan: true,
          versionId: recoveredVersion.id,
          routing: {
            ...routing,
            message: 'Documento existente sem versão visível foi regularizado e retornou ao fluxo de publicação.',
          },
        },
        { status: 201 },
      )
    }

     failureStage = 'documents:create-document-and-version'
    const created = await prisma.isoDocument.create({
      data: {
        code: payload.code,
        title: payload.title,
        documentTypeId: payload.documentTypeId,
        ownerDepartmentId: ownerCostCenter.departmentId ?? null,
        ownerCostCenterId: ownerCostCenter.id,
        authorUserId,
        physicalLocation: payload.physicalLocation,
        accessType: payload.accessType ?? 'INTERNO',
        validityAt: payload.validityAt ? new Date(payload.validityAt) : null,
        summary: payload.summary,
        affectedAreasNotes: payload.affectedAreasNotes,
        versions: {
          create: {
           revisionNumber,
            status: initialStatus,
            fileUrl: payload.fileUrl ?? null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            nextReviewAt: payload.nextReviewAt ? new Date(payload.nextReviewAt) : null,
            publishedAt: initialStatus === DocumentVersionStatus.PUBLICADO ? new Date() : null,
            isCurrentPublished: initialStatus === DocumentVersionStatus.PUBLICADO,
          },
        },
      },
      include: { versions: true },
    })

    failureStage = 'documents:create-approvals'
    if (flow.length > 0 && created.versions[0]) {
      await prisma.documentApproval.createMany({
        data: flow.map((item) => ({
          versionId: created.versions[0].id,
          flowItemId: item.id,
          status: DocumentApprovalStatus.PENDING,
        })),
      })
    }

   failureStage = 'response:success'
    const routing = routingForStatus(initialStatus)

     return NextResponse.json(
      {
        ...created,
        routing: {
          ...routing,
          message: createSuccessMessageByStatus(initialStatus),
        },
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'O código informado já está em uso. Informe outro código.' }, { status: 409 })
    }
    if (error instanceof DocumentPublishPipelineError) {
      const reasonMessage = {
        CONVERSION: 'Falha na conversão Word -> PDF. Verifique se o LibreOffice (LIBREOFFICE_PATH/SOFFICE_PATH) está instalado e acessível.',
        NOT_FOUND: 'Falha ao localizar o arquivo enviado no servidor.',
        WATERMARK: 'Falha ao aplicar a marca d’água no PDF final.',
        RULE: 'Regra inválida para o tipo documental informado.',
      }[error.reason]
      return NextResponse.json({ error: `${reasonMessage} Detalhes: ${error.message}` }, { status: 422 })
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro inesperado ao criar documento.'
    console.error('[documents.create][debug] failure', {
      stage: failureStage,
      message: errorMessage,
      error,
    })
    return NextResponse.json({ error: `Falha ao criar documento (${failureStage}): ${errorMessage}` }, { status: 500 })
  }
}