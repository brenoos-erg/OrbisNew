import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { ModuleLevel, SolicitationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withModuleLevel } from '@/lib/access'
import { nextSolicitationProtocolo } from '@/lib/protocolo'
import {
  EXTERNAL_ADMISSION_CHECKLIST,
  EXTERNAL_ADMISSION_STATUS,
  EXTERNAL_ADMISSION_TYPE_CODE,
  EXTERNAL_ADMISSION_TYPE_ID,
  EXTERNAL_ADMISSION_TYPE_NAME,
  toTokenHash,
} from '@/lib/externalAdmission'
import { sendExternalAdmissionEmail } from '@/lib/externalAdmissionEmail'
import { composePublicUrl, resolveAppBaseUrl } from '@/lib/site-url'
import { userHasRhAccess } from '@/lib/rhAccess'

async function ensureAdmissionType() {
  return prisma.tipoSolicitacao.upsert({
    where: { id: EXTERNAL_ADMISSION_TYPE_ID },
    update: {
      codigo: EXTERNAL_ADMISSION_TYPE_CODE,
      nome: EXTERNAL_ADMISSION_TYPE_NAME,
      schemaJson: {
        meta: {
          flow: 'external-admission',
          external: true,
          internalOnly: true,
          hiddenFromCreate: true,
          hiddenFromManualOpening: true,
        },
      },
    },
    create: {
      id: EXTERNAL_ADMISSION_TYPE_ID,
      codigo: EXTERNAL_ADMISSION_TYPE_CODE,
      nome: EXTERNAL_ADMISSION_TYPE_NAME,
      descricao: 'Fluxo externo de admissão com checklist e upload sem login.',
      schemaJson: {
        meta: {
          flow: 'external-admission',
          external: true,
          internalOnly: true,
          hiddenFromCreate: true,
          hiddenFromManualOpening: true,
        },
      },
    },
  })
}

async function resolveRhDepartmentId() {
  const rh = await prisma.department.findFirst({
    where: {
      OR: [{ code: '17' }, { sigla: { contains: 'RH' } }, { name: { contains: 'Recursos Humanos' } }],
    },
    select: { id: true },
  })
  return rh?.id ?? null
}

export const GET = withModuleLevel('solicitacoes', ModuleLevel.NIVEL_1, async (_req, ctx) => {
  const { me } = ctx
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem acessar solicitações externas de admissão.' }, { status: 403 })
  }
  await ensureAdmissionType()

  const rows = await prisma.solicitation.findMany({
    where: {
      tipoId: EXTERNAL_ADMISSION_TYPE_ID,
      status: { not: SolicitationStatus.CANCELADA },
      OR: me.role === 'ADMIN' ? undefined : [{ departmentId: me.departmentId ?? undefined }, { approverId: me.id }],
    },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      protocolo: true,
      status: true,
      updatedAt: true,
      payload: true,
      anexos: { select: { id: true } },
    } as any,
  })

  const parsed = rows.map((row: any) => {
    const metadata = (row.payload?.externalAdmission ?? {}) as Record<string, any>
    return {
      id: row.id,
      protocolo: row.protocolo,
      status: metadata.status ?? EXTERNAL_ADMISSION_STATUS.WAITING,
      candidateName: metadata.candidateName ?? '-',
      candidateEmail: metadata.candidateEmail ?? '-',
      externalUrl: metadata.externalUrl ?? null,
      emailDeliveryStatus: metadata.emailDeliveryStatus ?? 'NOT_SENT',
      emailSentAt: metadata.emailSentAt ?? null,
      emailError: metadata.emailError ?? null,
      emailResentAt: metadata.emailResentAt ?? null,
      updatedAt: row.updatedAt,
      completedAt: metadata.completedAt ?? null,
      createdLinkAt: metadata.createdLinkAt ?? null,
      sentDocuments: row.anexos?.length ?? 0,
      totalDocuments: Array.isArray(metadata.checklist) ? metadata.checklist.length : EXTERNAL_ADMISSION_CHECKLIST.length,
    }
  })

  const visibleRows = parsed.filter((row) => row.status !== 'EXCLUIDA')

  return NextResponse.json({ rows: visibleRows })
})

export const POST = withModuleLevel('solicitacoes', ModuleLevel.NIVEL_1, async (req, ctx) => {
  const { me } = ctx
  if (!(await userHasRhAccess(me))) {
    return NextResponse.json({ error: 'Apenas usuários de RH podem criar solicitações externas de admissão.' }, { status: 403 })
  }
  await ensureAdmissionType()

  const body = await req.json().catch(() => null)
  const candidateName = String(body?.candidateName ?? '').trim()
  const candidateEmail = String(body?.candidateEmail ?? '').trim().toLowerCase()

  if (!candidateName || !candidateEmail) {
    return NextResponse.json({ error: 'Nome e e-mail do candidato são obrigatórios.' }, { status: 400 })
  }

  const departmentId = (await resolveRhDepartmentId()) ?? me.departmentId
  if (!departmentId) {
    return NextResponse.json({ error: 'Não foi possível determinar o departamento de RH.' }, { status: 400 })
  }

  const baseUrl = resolveAppBaseUrl({ context: 'external-admission-link' })
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'Base pública da aplicação não configurada para gerar link externo.' },
      { status: 500 },
    )
  }

  const token = crypto.randomBytes(24).toString('hex')
  const tokenHash = toTokenHash(token)
  const externalUrl = composePublicUrl(baseUrl, `/solicitacoes/externo/admissao/${token}`)

  const protocolo = await nextSolicitationProtocolo()

  let emailSent = false
  let emailError: string | null = null
  let emailSentAt: string | null = null
  let emailDeliveryStatus = 'FAILED'

  const emailResult = await sendExternalAdmissionEmail({
    candidateName,
    candidateEmail,
    protocolo,
    externalUrl,
  })

  if (emailResult.sent) {
    emailSent = true
    emailSentAt = new Date().toISOString()
    emailDeliveryStatus = 'SENT'
  } else {
    emailError = emailResult.error
    console.error('[external-admission] falha ao enviar e-mail inicial', {
      candidateEmail,
      protocolo,
      error: emailResult.error,
    })
  }

  const created = await prisma.solicitation.create({
    data: {
      protocolo,
      tipoId: EXTERNAL_ADMISSION_TYPE_ID,
      titulo: EXTERNAL_ADMISSION_TYPE_NAME,
      descricao: `Checklist externo de admissão para ${candidateName}.`,
      departmentId,
      solicitanteId: me.id,
      approverId: me.id,
      status: SolicitationStatus.ABERTA,
      payload: {
        externalAdmission: {
          candidateName,
          candidateEmail,
          checklist: EXTERNAL_ADMISSION_CHECKLIST,
          checklistStatus: {},
          tokenHash,
          status: EXTERNAL_ADMISSION_STATUS.WAITING,
          createdLinkAt: new Date().toISOString(),
          externalUrl,
          submissions: {},
          emailDeliveryStatus,
          emailSentAt,
          emailError,
        },
      },
    },
    select: { id: true, protocolo: true },
  })

  return NextResponse.json(
    {
      ...created,
      externalUrl,
      emailSent,
      emailError,
      externalAdmission: {
        emailSentAt,
        emailDeliveryStatus,
        emailError,
      },
    },
    { status: 201 },
  )
})
