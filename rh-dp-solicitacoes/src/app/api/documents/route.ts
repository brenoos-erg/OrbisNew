import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { DocumentVersionStatus } from '@prisma/client'
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
            status: DocumentVersionStatus.EM_ELABORACAO,
            fileUrl: payload.fileUrl ?? null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            nextReviewAt: payload.nextReviewAt ? new Date(payload.nextReviewAt) : null,
          },
        },
      },
      include: { versions: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar documento ISO', error)
    return NextResponse.json({ error: 'Erro ao criar documento.' }, { status: 500 })
  }
}