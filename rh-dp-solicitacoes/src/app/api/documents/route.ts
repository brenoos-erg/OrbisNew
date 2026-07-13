import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus, Prisma } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import {
  createSuccessMessageByStatus,
  resolveInitialVersionStatus,
  routingForStatus,
}  from '@/lib/iso-document-routing'
import { resolveInitialRevisionNumber } from '@/lib/isoDocumentCreation'
import { prisma } from '@/lib/prisma'
import { removePrivateDocumentSourceFile, savePrivateDocumentSourceFile } from '@/lib/documents/documentStorage'
import { codeMatchesRequiredPrefix, resolveDocumentCodePrefixFromTypeCode } from '@/lib/documents/documentCodePrefix'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'
import { logDocumentNotificationFailure, resolvePublicationNotificationEvent } from '@/lib/documents/documentPublicationNotification'
import { canCreateDocument, canCreateRevision, hasDocumentPermission } from '@/lib/documents/documentRoleAccess'
import { startDocumentApprovalFlow } from '@/lib/documents/documentApprovalTransition'
import { DocumentPublicationError, publishDocumentVersion } from '@/lib/documents/publishDocumentVersion'

function normalizeCode(raw: unknown) {
  return String(raw ?? '').trim()
}

function sanitizeCreatedDocumentForResponse<T extends { versions?: Array<Record<string, any>> }>(document: T) {
  return {
    ...document,
    versions: document.versions?.map(({ sourceStorageKey, sourceFileUrl, ...version }) => ({
      ...version,
      sourceFileAvailable: Boolean(sourceStorageKey || sourceFileUrl),
    })),
  }
}

async function saveUploadedDocument(file: File, documentCode: string, revisionNumber = 0) {
  const stored = await savePrivateDocumentSourceFile(file, 'doc')
  console.info('[documents.create] private-source-upload-persisted', { originalName: stored.originalName, storageKey: stored.storageKey, documentCode, revisionNumber, size: stored.size })
  return stored
}

export async function POST(req: NextRequest)   {
  let failureStage = 'request:start'
  const privateSourceKeysToCleanup: string[] = []
  let shouldCleanupPrivateSource = true
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
      let sourceFile: Awaited<ReturnType<typeof saveUploadedDocument>> | null = null

      if (uploadedFile instanceof File && uploadedFile.size > 0) {
        failureStage = 'file:save-uploaded-document'
        sourceFile = await saveUploadedDocument(uploadedFile, code, resolveInitialRevisionNumber(form.get('revisionNumber')))
        privateSourceKeysToCleanup.push(sourceFile.storageKey)
      }

      payload = {
        code,
        title: String(form.get('title') ?? ''),
        documentTypeId: String(form.get('documentTypeId') ?? ''),
        ownerCostCenterId: String(form.get('ownerCostCenterId') ?? ''),
        authorUserId: String(form.get('authorUserId') ?? '').trim(),
        summary: String(form.get('summary') ?? ''),
        affectedAreasNotes: String(form.get('affectedAreasNotes') ?? ''),
        revisionReason: String(form.get('revisionReason') ?? '').trim(),
        sourceStorageKey: sourceFile?.storageKey ?? null,
        sourceOriginalName: sourceFile?.originalName ?? null,
        sourceMimeType: sourceFile?.mimeType ?? null,
        sourceSizeBytes: sourceFile?.size ?? null,
        sourceSha256: sourceFile?.sha256 ?? null,
        revisionNumber: form.get('revisionNumber'),
      }
    } else {
       payload = await req.json()
      payload.code = normalizeCode(payload.code)
      payload.ownerCostCenterId = payload.ownerCostCenterId ?? ''
      payload.authorUserId = String(payload.authorUserId ?? '').trim()
      payload.revisionReason = String(payload.revisionReason ?? '').trim()
    }

    console.info('[documents.create][debug] payload-received', {
      hasMultipart: contentType.includes('multipart/form-data'),
      code: payload.code ?? '',
      title: payload.title ?? '',
      documentTypeId: payload.documentTypeId ?? '',
      ownerCostCenterId: payload.ownerCostCenterId ?? '',
      authorUserId: payload.authorUserId || me.id,
      revisionNumber: payload.revisionNumber ?? null,
      hasRevisionReason: Boolean(payload.revisionReason),
      hasFileUrl: Boolean(payload.sourceStorageKey ?? payload.fileUrl),
    })


    const authorUserId = payload.authorUserId || me.id

    failureStage = 'validation:required-fields'
    if (!payload.code || !payload.title || !payload.documentTypeId || !payload.ownerCostCenterId) {
      return NextResponse.json({ error: 'Preencha código, título, tipo de documento e centro responsável.' }, { status: 400 })
    }

    
    if (!(payload.sourceStorageKey ?? payload.fileUrl)) {
      return NextResponse.json({ error: 'Anexe um arquivo válido: PDF, DOC, DOCX, XLS ou XLSX.' }, { status: 400 })
    }

    failureStage = 'validation:document-type'
    const documentType = await prisma.documentTypeCatalog.findUnique({
      where: { id: String(payload.documentTypeId) },
      select: { id: true, code: true, controlledCopy: true },
    })

    if (!documentType) {
      return NextResponse.json({ error: 'Tipo de documento inválido.' }, { status: 400 })
    }

    const requiredCodePrefix = resolveDocumentCodePrefixFromTypeCode(documentType.code)
    if (!codeMatchesRequiredPrefix(payload.code, requiredCodePrefix)) {
      return NextResponse.json(
        {
          error: `Código incompatível com o tipo documental selecionado. Este tipo exige prefixo "${requiredCodePrefix}".`,
        },
        { status: 400 },
      )
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
      sourceStorageKey: payload.sourceStorageKey ?? null,
    })

    failureStage = 'document-type-flow:load'
    const flow = await prisma.documentTypeApprovalFlow.findMany({
      where: { documentTypeId: payload.documentTypeId, active: true },
      orderBy: { order: 'asc' },
      include: { approverGroup: { include: { members: { include: { user: { select: { status: true } } } } } } },
    })

    const directPublicationJustification = String(payload.directPublicationJustification ?? '').trim()
    const userModuleLevel = await getUserModuleLevel(me.id, MODULE_KEYS.CONTROLE_DOCUMENTOS)
    let initialStatus: DocumentVersionStatus
    try {
      initialStatus = resolveInitialVersionStatus(flow, {
        documentTypeControlledCopy: documentType.controlledCopy,
        documentTypeCode: documentType.code,
        documentCode: payload.code,
        userModuleLevel,
        directPublicationJustification,
      })
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      throw error
    }
    const requestedInitialRevisionNumber = resolveInitialRevisionNumber(payload.revisionNumber)

    failureStage = 'documents:check-existing-code'
    const existing = await prisma.isoDocument.findFirst({
      where: { activeCode: payload.code },
      select: {
        id: true,
        code: true,
        title: true,
        documentTypeId: true,
        ownerDepartmentId: true,
        ownerCostCenterId: true,
        authorUserId: true,
        physicalLocation: true,
        accessType: true,
        validityAt: true,
        summary: true,
        affectedAreasNotes: true,
        versions: {
          orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { id: true, status: true, revisionNumber: true },
        },
      },
    })

    const permissionContext = { documentTypeId: payload.documentTypeId, departmentId: ownerCostCenter.departmentId ?? null, costCenterId: ownerCostCenter.id, documentFamily: String(payload.code).split('.')[1] ?? null }

    if (existing && !(await canCreateRevision(me.id, { ...permissionContext, documentId: existing.id }))) {
      return NextResponse.json({ error: 'Você não possui permissão para criar revisão neste escopo documental.' }, { status: 403 })
    }
    if (!existing && !(await canCreateDocument(me.id, permissionContext))) {
      return NextResponse.json({ error: 'Você não possui permissão para criar documento neste escopo documental.' }, { status: 403 })
    }
    const directPublicationRequested = initialStatus === DocumentVersionStatus.PUBLICADO
    if (directPublicationRequested && !(await hasDocumentPermission(me.id, 'CAN_DIRECT_PUBLISH', permissionContext))) {
      return NextResponse.json({ error: 'Publicação direta exige papel e permissão CAN_DIRECT_PUBLISH.' }, { status: 403 })
    }
    if (directPublicationRequested) initialStatus = DocumentVersionStatus.AGUARDANDO_PUBLICACAO

    if (existing && !payload.revisionReason) {
      return NextResponse.json(
        { error: 'Informe o motivo da revisão para criar uma nova revisão de código existente.' },
        { status: 400 },
      )
    }

    if (existing) {
      const currentRevisionNumber = existing.versions[0]?.revisionNumber ?? null
      const nextRevisionNumber = currentRevisionNumber === null ? requestedInitialRevisionNumber : currentRevisionNumber + 1

      failureStage = currentRevisionNumber === null ? 'documents:recover-orphan-version' : 'documents:create-next-revision'
      const revisedVersion = await prisma.$transaction(async (tx) => {
        await tx.isoDocument.update({
          where: { id: existing.id },
          data: {
            title: payload.title,
            documentTypeId: payload.documentTypeId,
            ownerDepartmentId: ownerCostCenter.departmentId ?? null,
            ownerCostCenterId: ownerCostCenter.id,
            authorUserId,
            physicalLocation: payload.physicalLocation,
            accessType: payload.accessType ?? existing.accessType ?? 'INTERNO',
            validityAt: payload.validityAt ? new Date(payload.validityAt) : existing.validityAt,
            summary: payload.summary ?? existing.summary,
            affectedAreasNotes: payload.affectedAreasNotes ?? existing.affectedAreasNotes,
          },
        })

        if (initialStatus === DocumentVersionStatus.PUBLICADO) {
          await tx.documentVersion.updateMany({
            where: { documentId: existing.id, isCurrentPublished: true },
            data: { isCurrentPublished: false, obsoleteAt: new Date(), obsoletedById: me.id, obsoleteReason: payload.revisionReason || 'Substituído por nova revisão publicada.' },
          })
        }

        const version = await tx.documentVersion.create({
          data: {
            documentId: existing.id,
            revisionNumber: nextRevisionNumber,
            status: initialStatus,
            fileUrl: null,
            sourceFileUrl: payload.fileUrl ?? null,
            sourceStorageKey: payload.sourceStorageKey ?? null,
            sourceOriginalName: payload.sourceOriginalName ?? null,
            sourceMimeType: payload.sourceMimeType ?? null,
            sourceSizeBytes: payload.sourceSizeBytes ?? null,
            sourceSha256: payload.sourceSha256 ?? null,
            revisionReason: payload.revisionReason,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            nextReviewAt: payload.nextReviewAt ? new Date(payload.nextReviewAt) : null,
            publishedAt: null,
            isCurrentPublished: false,
          },
        })
        if (flow.length > 0 && !directPublicationRequested) {
          await tx.documentApproval.createMany({
            data: flow.map((item) => ({
              versionId: version.id,
              flowItemId: item.id,
              status: DocumentApprovalStatus.PENDING,
            })),
          })
          await startDocumentApprovalFlow(tx, { versionId: version.id, flow })
        }

        return version
      })

      shouldCleanupPrivateSource = false
      privateSourceKeysToCleanup.length = 0
      if (directPublicationJustification) {
        await sendDocumentNotification('DOCUMENT_CREATED', { documentId: existing.id, versionId: revisedVersion.id }).catch((error) => console.error('DOCUMENT_CREATED notification failed', error))
        try {
          await publishDocumentVersion({ versionId: revisedVersion.id, actorUserId: me.id, justification: directPublicationJustification, directPublication: true })
        } catch (error) {
          if (error instanceof DocumentPublicationError) {
            if (error.details?.exceptionId) return NextResponse.json({ status: 'SEGREGATION_EXCEPTION_PENDING', documentId: existing.id, versionId: revisedVersion.id, exceptionId: error.details.exceptionId, routing: routingForStatus(DocumentVersionStatus.AGUARDANDO_PUBLICACAO), message: 'Documento criado. A publicação direta aguarda aprovação da exceção.' }, { status: 202 })
            return NextResponse.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      }
      const routing = routingForStatus(directPublicationJustification ? DocumentVersionStatus.PUBLICADO : initialStatus)
      if (!directPublicationJustification) void sendDocumentNotification('DOCUMENT_CREATED', {
        documentId: existing.id,
        versionId: revisedVersion.id,
      }).catch((error) => console.error('DOCUMENT_CREATED notification failed', error))

      if (initialStatus === DocumentVersionStatus.AG_APROVACAO) {
        void sendDocumentNotification('DOCUMENT_SUBMITTED_FOR_APPROVAL', {
          documentId: existing.id,
          versionId: revisedVersion.id,
        }).catch((error) => console.error('DOCUMENT_SUBMITTED_FOR_APPROVAL notification failed', error))
      }
      if (directPublicationRequested) {
        const publicationEvent = resolvePublicationNotificationEvent(revisedVersion)
        void sendDocumentNotification(publicationEvent, {
          documentId: existing.id,
          versionId: revisedVersion.id,
        }).catch(logDocumentNotificationFailure(publicationEvent))
      }
      return NextResponse.json(
        {
          id: existing.id,
          createdRevision: true,
          currentRevisionNumber,
          nextRevisionNumber,
          versionId: revisedVersion.id,
          routing: {
            ...routing,
            message:
              currentRevisionNumber === null
                ? 'Documento existente sem versão visível foi regularizado e retornou ao fluxo de publicação.'
                : `Nova revisão criada com sucesso (REV${String(nextRevisionNumber).padStart(2, '0')}).`,
          },
        },
        { status: 201 },
      )
    }

     failureStage = 'documents:create-document-and-version'
    const created = await prisma.isoDocument.create({
      data: {
        code: payload.code,
        activeCode: payload.code,
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
           revisionNumber: requestedInitialRevisionNumber,
            status: initialStatus,
            fileUrl: null,
            sourceFileUrl: payload.fileUrl ?? null,
            sourceStorageKey: payload.sourceStorageKey ?? null,
            sourceOriginalName: payload.sourceOriginalName ?? null,
            sourceMimeType: payload.sourceMimeType ?? null,
            sourceSizeBytes: payload.sourceSizeBytes ?? null,
            sourceSha256: payload.sourceSha256 ?? null,
            revisionReason: null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            nextReviewAt: payload.nextReviewAt ? new Date(payload.nextReviewAt) : null,
            publishedAt: null,
            isCurrentPublished: false,
          },
        },
      },
      include: { versions: true },
    })

    failureStage = 'documents:create-approvals'
    if (flow.length > 0 && !directPublicationRequested && created.versions[0]) {
      await prisma.$transaction(async (tx) => {
        await tx.documentApproval.createMany({
          data: flow.map((item) => ({
            versionId: created.versions[0].id,
            flowItemId: item.id,
            status: DocumentApprovalStatus.PENDING,
          })),
        })
        await startDocumentApprovalFlow(tx, { versionId: created.versions[0].id, flow })
      })
    }

    shouldCleanupPrivateSource = false
    privateSourceKeysToCleanup.length = 0
    if (created.versions[0] && directPublicationJustification) {
      await sendDocumentNotification('DOCUMENT_CREATED', { documentId: created.id, versionId: created.versions[0].id }).catch((error) => console.error('DOCUMENT_CREATED notification failed', error))
      try {
        await publishDocumentVersion({ versionId: created.versions[0].id, actorUserId: me.id, justification: directPublicationJustification, directPublication: true })
      } catch (error) {
        if (error instanceof DocumentPublicationError) {
          if (error.details?.exceptionId) return NextResponse.json({ status: 'SEGREGATION_EXCEPTION_PENDING', documentId: created.id, versionId: created.versions[0].id, exceptionId: error.details.exceptionId, routing: routingForStatus(DocumentVersionStatus.AGUARDANDO_PUBLICACAO), message: 'Documento criado. A publicação direta aguarda aprovação da exceção.' }, { status: 202 })
          return NextResponse.json({ error: error.message }, { status: error.status })
        }
        throw error
      }
    }

    if (created.versions[0]) {
      if (!directPublicationJustification) void sendDocumentNotification('DOCUMENT_CREATED', {
        documentId: created.id,
        versionId: created.versions[0].id,
      }).catch((error) => console.error('DOCUMENT_CREATED notification failed', error))

      if (initialStatus === DocumentVersionStatus.AG_APROVACAO) {
        void sendDocumentNotification('DOCUMENT_SUBMITTED_FOR_APPROVAL', {
          documentId: created.id,
          versionId: created.versions[0].id,
        }).catch((error) => console.error('DOCUMENT_SUBMITTED_FOR_APPROVAL notification failed', error))
      }
      if (directPublicationRequested) {
        const publicationEvent = resolvePublicationNotificationEvent(created.versions[0])
        void sendDocumentNotification(publicationEvent, {
          documentId: created.id,
          versionId: created.versions[0].id,
        }).catch(logDocumentNotificationFailure(publicationEvent))
      }
    }

   failureStage = 'response:success'
    const routing = routingForStatus(directPublicationJustification ? DocumentVersionStatus.PUBLICADO : initialStatus)

     return NextResponse.json(
      {
        ...sanitizeCreatedDocumentForResponse(created),
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
    const errorMessage = error instanceof Error ? error.message : 'Erro inesperado ao criar documento.'
    console.error('[documents.create][debug] failure', {
      stage: failureStage,
      message: errorMessage,
      error,
    })
    return NextResponse.json({ error: `Falha ao criar documento (${failureStage}): ${errorMessage}` }, { status: 500 })
  } finally {
    if (shouldCleanupPrivateSource && privateSourceKeysToCleanup.length > 0) {
      await Promise.all(privateSourceKeysToCleanup.map((key) => removePrivateDocumentSourceFile(key).catch(() => undefined)))
    }
  }
}
