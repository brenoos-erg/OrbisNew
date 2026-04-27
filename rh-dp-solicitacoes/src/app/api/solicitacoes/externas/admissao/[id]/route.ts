import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { EXTERNAL_ADMISSION_STATUS, EXTERNAL_ADMISSION_TYPE_ID } from '@/lib/externalAdmission'
import { sendExternalAdmissionEmail } from '@/lib/externalAdmissionEmail'
import { userHasRhAccess } from '@/lib/rhAccess'

async function assertAccess(userId: string) {
  await assertUserMinLevel(userId, 'solicitacoes', ModuleLevel.NIVEL_1)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  await assertAccess(me.id)
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem acessar detalhes internos de admissões externas.' }, { status: 403 })
  }

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
    externalUrl: admission.externalUrl ?? null,
    checklist: admission.checklist ?? [],
    checklistStatus: admission.checklistStatus ?? {},
    submissions: admission.submissions ?? {},
    emailDeliveryStatus: admission.emailDeliveryStatus ?? 'NOT_SENT',
    emailSentAt: admission.emailSentAt ?? null,
    emailResentAt: admission.emailResentAt ?? null,
    emailError: admission.emailError ?? null,
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
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem atualizar admissões externas.' }, { status: 403 })
  }

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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  await assertAccess(me.id)
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem reenviar e-mail de admissões externas.' }, { status: 403 })
  }

  const id = (await params).id
  const solicitation = await prisma.solicitation.findFirst({ where: { id, tipoId: EXTERNAL_ADMISSION_TYPE_ID } })
  if (!solicitation) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const admission = ((solicitation.payload as any)?.externalAdmission ?? {}) as Record<string, any>
  const candidateName = String(admission.candidateName ?? '').trim()
  const candidateEmail = String(admission.candidateEmail ?? '').trim().toLowerCase()
  const externalUrl = String(admission.externalUrl ?? '').trim()

  if (!candidateName || !candidateEmail || !externalUrl) {
    return NextResponse.json({ error: 'Dados de envio incompletos para reenviar e-mail.' }, { status: 400 })
  }

  const result = await sendExternalAdmissionEmail({
    candidateName,
    candidateEmail,
    protocolo: solicitation.protocolo,
    externalUrl,
  })

  const sentAt = result.sent ? new Date().toISOString() : null
  const nextAdmission = {
    ...admission,
    emailDeliveryStatus: result.sent ? 'RESENT' : 'FAILED',
    emailError: result.sent ? null : result.error,
    emailResentAt: sentAt,
    emailSentAt: result.sent ? sentAt : admission.emailSentAt ?? null,
  }

  await prisma.solicitation.update({
    where: { id },
    data: {
      payload: {
        ...(solicitation.payload as Record<string, unknown>),
        externalAdmission: nextAdmission,
      },
    },
  })

  if (!result.sent) {
    console.error('[external-admission] falha ao reenviar e-mail', {
      solicitationId: id,
      protocolo: solicitation.protocolo,
      candidateEmail,
      error: result.error,
    })
  }

  return NextResponse.json({ ok: true, emailSent: result.sent, emailError: result.error ?? null, emailResentAt: sentAt })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  await assertAccess(me.id)
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem excluir admissões externas.' }, { status: 403 })
  }

  const id = (await params).id
  const solicitation = await prisma.solicitation.findFirst({ where: { id, tipoId: EXTERNAL_ADMISSION_TYPE_ID } })
  if (!solicitation) return NextResponse.json({ error: 'Processo não encontrado.' }, { status: 404 })

  const admission = ((solicitation.payload as any)?.externalAdmission ?? {}) as Record<string, any>
  const currentStatus = String(admission.status ?? '')
  if (solicitation.status === 'CANCELADA' || currentStatus === 'EXCLUIDA') {
    return NextResponse.json({ ok: true, alreadyDeleted: true })
  }

  await prisma.solicitation.update({
    where: { id },
    data: {
      status: 'CANCELADA',
      dataCancelamento: new Date(),
      payload: {
        ...(solicitation.payload as Record<string, unknown>),
        externalAdmission: {
          ...admission,
          status: 'EXCLUIDA',
          deletedAt: new Date().toISOString(),
          deletedById: me.id,
          deletionMode: 'SOFT_DELETE',
        },
      },
    },
  })

  return NextResponse.json({ ok: true })
}
