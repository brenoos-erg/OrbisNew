import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentApprovalStatus, DocumentFlowStepType, DocumentVersionStatus } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function savePdf(file: File) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
  await fs.mkdir(uploadDir, { recursive: true })
  const safeName = `${Date.now()}-${randomUUID()}-${file.name.replace(/\s+/g, '-')}`
  const absolute = path.join(uploadDir, safeName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(absolute, buffer)
  return `/uploads/documents/${safeName}`
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()

    const contentType = req.headers.get('content-type') ?? ''
    let payload: any = {}

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const pdf = form.get('pdf')
      const fileUrl = pdf instanceof File && pdf.size > 0 ? await savePdf(pdf) : null

      payload = {
        code: String(form.get('code') ?? ''),
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
    }

    if (!payload.code || !payload.title || !payload.documentTypeId || !payload.ownerDepartmentId) {
      return NextResponse.json({ error: 'Preencha código, título, tipo de documento e centro responsável.' }, { status: 400 })
    }


    const flow = await prisma.documentTypeApprovalFlow.findMany({
      where: { documentTypeId: payload.documentTypeId, active: true },
      orderBy: { order: 'asc' },
      select: { id: true, stepType: true },
    })

    const firstStepType = flow[0]?.stepType ?? null
    const initialStatus =
      flow.length === 0
        ? DocumentVersionStatus.PUBLICADO
        : firstStepType === DocumentFlowStepType.QUALITY
          ? DocumentVersionStatus.EM_ANALISE_QUALIDADE
          : DocumentVersionStatus.AG_APROVACAO

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
            revisionNumber: payload.revisionNumber ?? 1,
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

    const routing =
      initialStatus === DocumentVersionStatus.PUBLICADO
        ? {
            status: initialStatus,
            targetTab: 'publicados',
            targetPath: '/dashboard/controle-documentos/publicados',
            message: 'Documento publicado com sucesso.',
          }
        : initialStatus === DocumentVersionStatus.EM_ANALISE_QUALIDADE
          ? {
              status: initialStatus,
              targetTab: 'em-analise-qualidade',
              targetPath: '/dashboard/controle-documentos/em-analise-qualidade',
              message: 'Documento enviado com sucesso e encaminhado para revisão da qualidade.',
            }
          : {
              status: initialStatus,
              targetTab: 'para-aprovacao',
              targetPath: '/dashboard/controle-documentos/para-aprovacao',
              message: 'Documento enviado com sucesso e encaminhado para aprovação.',
            }

    return NextResponse.json({ ...created, routing }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar documento ISO', error)
    return NextResponse.json({ error: 'Erro ao criar documento.' }, { status: 500 })
  }
}