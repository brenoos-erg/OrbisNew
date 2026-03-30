import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentVersionStatus, Prisma } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import {
  createSuccessMessageByStatus,
  duplicateCodeMessage,
  resolveInitialVersionStatus,
  routingForStatus,
} from '@/lib/iso-document-routing'
import { prisma } from '@/lib/prisma'

function normalizeCode(raw: unknown) {
  return String(raw ?? '').trim()
}

async function savePdf(file: File) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
  await fs.mkdir(uploadDir, { recursive: true })
  const safeName = `${Date.now()}-${randomUUID()}-${file.name.replace(/\s+/g, '-')}`
  const absolute = path.join(uploadDir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(absolute, buffer)
  return `/uploads/documents/${safeName}`
}

export async function POST(req: NextRequest)   {
  try {
    const me = await requireActiveUser()

    const contentType = req.headers.get('content-type') ?? ''
    let payload: any = {}

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const pdf = form.get('pdf')
      const fileUrl = pdf instanceof File && pdf.size > 0 ? await savePdf(pdf) : null

      payload = {
        code: normalizeCode(form.get('code')),
        title: String(form.get('title') ?? ''),
        documentTypeId: String(form.get('documentTypeId') ?? ''),
        ownerDepartmentId: String(form.get('ownerDepartmentId') ?? ''),
        authorUserId: String(form.get('authorUserId') ?? me.id),
        summary: String(form.get('summary') ?? ''),
        affectedAreasNotes: String(form.get('affectedAreasNotes') ?? ''),
        fileUrl,
      }
    } else {
      payload = await req.json()
      payload.code = normalizeCode(payload.code)
    }

    if (!payload.code || !payload.title || !payload.documentTypeId || !payload.ownerDepartmentId) {
      return NextResponse.json({ error: 'Preencha código, título, tipo de documento e centro responsável.' }, { status: 400 })
    }


    const flow = await prisma.documentTypeApprovalFlow.findMany({
      where: { documentTypeId: payload.documentTypeId, active: true },
      orderBy: { order: 'asc' },
      select: { id: true, stepType: true },
    })

    const initialStatus = resolveInitialVersionStatus(flow)

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
      const recoveredVersion = await prisma.$transaction(async (tx) => {
        const version = await tx.documentVersion.create({
          data: {
            documentId: existing.id,
            revisionNumber: payload.revisionNumber ?? 0,
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

    const created = await prisma.isoDocument.create({
      data: {
        code: payload.code,
        title: payload.title,
        documentTypeId: payload.documentTypeId,
        ownerDepartmentId: payload.ownerDepartmentId,
        authorUserId: payload.authorUserId ?? me.id,
        physicalLocation: payload.physicalLocation,
        accessType: payload.accessType ?? 'INTERNO',
        validityAt: payload.validityAt ? new Date(payload.validityAt) : null,
        summary: payload.summary,
        affectedAreasNotes: payload.affectedAreasNotes,
        versions: {
          create: {
           revisionNumber: payload.revisionNumber ?? 0,
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

    if (flow.length > 0 && created.versions[0]) {
      await prisma.documentApproval.createMany({
        data: flow.map((item) => ({
          versionId: created.versions[0].id,
          flowItemId: item.id,
          status: DocumentApprovalStatus.PENDING,
        })),
      })
    }

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

    console.error('Erro ao criar documento ISO', error)
    return NextResponse.json({ error: 'Erro ao criar documento.' }, { status: 500 })
  }
}