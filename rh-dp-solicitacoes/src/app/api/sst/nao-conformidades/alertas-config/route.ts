import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureNonConformityAlertConfig } from '@/lib/sst/nonConformityAlertConfig'

function parseRecipients(raw: unknown) {
  if (!Array.isArray(raw)) return [] as Array<{ email: string; fullName?: string | null }>
  const normalized = raw
    .map((item) => ({
      email: String((item as any)?.email ?? '').trim().toLowerCase(),
      fullName: String((item as any)?.fullName ?? '').trim() || null,
    }))
    .filter((item) => item.email.includes('@'))

  const dedup = new Map<string, { email: string; fullName?: string | null }>()
  for (const recipient of normalized) dedup.set(recipient.email, recipient)
  return Array.from(dedup.values())
}

export async function GET() {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores podem acessar esta configuração.' }, { status: 403 })

  const config = await ensureNonConformityAlertConfig()
  return NextResponse.json({
    id: config.id,
    eventCreatedEnabled: config.eventCreatedEnabled,
    eventUpdatedEnabled: config.eventUpdatedEnabled,
    subjectTemplate: config.subjectTemplate,
    bodyTemplate: config.bodyTemplate,
    recipients: config.recipients.map((recipient: { id: string; email: string; fullName: string | null; active: boolean }) => ({ id: recipient.id, email: recipient.email, fullName: recipient.fullName, active: recipient.active })),
  })
}

export async function PUT(req: NextRequest) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores podem editar esta configuração.' }, { status: 403 })

  const body = await req.json().catch(() => ({} as any))
  const config = await ensureNonConformityAlertConfig()
  const recipients = parseRecipients(body?.recipients)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.nonConformityAlertRecipient.updateMany({ where: { configId: config.id }, data: { active: false } })
    if (recipients.length > 0) {
      for (const recipient of recipients) {
        await tx.nonConformityAlertRecipient.upsert({
          where: { configId_email: { configId: config.id, email: recipient.email } },
          update: { fullName: recipient.fullName, active: true },
          create: { configId: config.id, email: recipient.email, fullName: recipient.fullName, active: true },
        })
      }
    }

    return tx.nonConformityAlertConfig.update({
      where: { id: config.id },
      data: {
        eventCreatedEnabled: Boolean(body?.eventCreatedEnabled),
        eventUpdatedEnabled: Boolean(body?.eventUpdatedEnabled),
        subjectTemplate: String(body?.subjectTemplate ?? config.subjectTemplate).trim() || config.subjectTemplate,
        bodyTemplate: String(body?.bodyTemplate ?? config.bodyTemplate).trim() || config.bodyTemplate,
      },
      include: { recipients: { where: { active: true }, orderBy: { email: 'asc' } } },
    })
  })

  return NextResponse.json({
    id: updated.id,
    eventCreatedEnabled: updated.eventCreatedEnabled,
    eventUpdatedEnabled: updated.eventUpdatedEnabled,
    subjectTemplate: updated.subjectTemplate,
    bodyTemplate: updated.bodyTemplate,
    recipients: updated.recipients,
  })
}
