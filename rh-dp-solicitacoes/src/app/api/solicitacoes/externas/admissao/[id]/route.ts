import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { EXTERNAL_ADMISSION_STATUS, EXTERNAL_ADMISSION_TYPE_ID } from '@/lib/externalAdmission'

async function assertAccess(userId: string) {
  await assertUserMinLevel(userId, 'solicitacoes', ModuleLevel.NIVEL_1)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  await assertAccess(me.id)

  const id = (await params).id
  const solicitation = await prisma.solicitation.findFirst({
    where: { id, tipoId: EXTERNAL_ADMISSION_TYPE_ID },
    include: { anexos: { orderBy: { createdAt: 'asc' } } },
  })

  if (!solicitation) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const admission = ((solicitation.payload as any)?.externalAdmission ?? {}) as Record<string, any>

  return NextResponse.json({
    id: solicitation.id,
    protocolo: solicitation.protocolo,
    status: admission.status ?? EXTERNAL_ADMISSION_STATUS.WAITING,
    candidateName: admission.candidateName ?? '',
    candidateEmail: admission.candidateEmail ?? '',
    checklist: admission.checklist ?? [],
    checklistStatus: admission.checklistStatus ?? {},
    submissions: admission.submissions ?? {},
    files: solicitation.anexos.map((file) => ({
      id: file.id,
      filename: file.filename,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
      url: `/api/solicitacoes/${solicitation.id}/anexos/${file.id}`,
    })),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  await assertAccess(me.id)

  const id = (await params).id
  const body = await req.json().catch(() => null)
  const status = String(body?.status ?? '').trim()

  if (!Object.values(EXTERNAL_ADMISSION_STATUS).includes(status as any)) {
    return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  }

  const solicitation = await prisma.solicitation.findFirst({ where: { id, tipoId: EXTERNAL_ADMISSION_TYPE_ID } })
  if (!solicitation) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const admission = ((solicitation.payload as any)?.externalAdmission ?? {}) as Record<string, any>
  await prisma.solicitation.update({
    where: { id },
    data: {
      payload: {
        ...(solicitation.payload as Record<string, unknown>),
        externalAdmission: { ...admission, status, reviewedAt: new Date().toISOString() },
      },
    },
  })

  return NextResponse.json({ ok: true })
}
