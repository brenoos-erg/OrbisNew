export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canRequesterEditRq092AfterSubmit } from '@/lib/solicitationAccessPolicy'
import { isSolicitacaoExamesSst } from '@/lib/solicitationTypes'
import { normalizeSolicitationPayload } from '@/lib/solicitationDetailPayload'
import { registerAppError } from '@/lib/errorRegistry'

type CampoSchema = {
  name?: unknown
  label?: unknown
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {}
}

function getRq092FieldLabels(schemaJson: unknown) {
  const schema = asRecord(schemaJson)
  const campos = Array.isArray(schema.camposEspecificos) ? (schema.camposEspecificos as CampoSchema[]) : []
  return new Map(
    campos
      .filter((campo) => typeof campo.name === 'string' && campo.name.trim())
      .map((campo) => [String(campo.name), typeof campo.label === 'string' && campo.label.trim() ? campo.label : String(campo.name)]),
  )
}

function valuesAreEqual(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function truncateTimelineMessage(message: string, maxLength = 190) {
  return message.length > maxLength ? `${message.slice(0, maxLength - 3)}...` : message
}

function buildRq092CorrectionTimelineMessage(params: {
  actorName: string
  changes: Array<{ label: string }>
  justification: string
}) {
  const changedLabels = params.changes.map((change) => change.label).slice(0, 5).join(', ')
  const extraCount = Math.max(0, params.changes.length - 5)
  const fieldsSummary = `${changedLabels}${extraCount > 0 ? ` e mais ${extraCount}` : ''}`
  const shortJustification =
    params.justification.length > 80 ? `${params.justification.slice(0, 77)}...` : params.justification

  return truncateTimelineMessage(
    `Correção da RQ.092 registrada por ${params.actorName}. Campos alterados: ${fieldsSummary}. Justificativa: ${shortJustification}`,
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let solicitationId: string | undefined
  let userId: string | undefined
  let userLogin: string | null | undefined

  try {
    const me = await requireActiveUser()
    userId = me.id
    userLogin = me.login
    const { id } = await params
    solicitationId = id
    const body = await req.json().catch(() => ({}))
    const requestedCampos = asRecord(body.campos)
    const justification = typeof body.justification === 'string' ? body.justification.trim() : ''

    if (!justification) {
      return NextResponse.json({ error: 'Informe a justificativa da alteração.' }, { status: 400 })
    }

    const solicitation = await prisma.solicitation.findUnique({
      where: { id },
      include: { tipo: true },
    })

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!isSolicitacaoExamesSst(solicitation.tipo)) {
      return NextResponse.json({ error: 'Correção após envio permitida somente para RQ.092 - Solicitação de exames.' }, { status: 403 })
    }

    if (!canRequesterEditRq092AfterSubmit(me.id, solicitation)) {
      return NextResponse.json({ error: 'Apenas o solicitante original pode corrigir a própria RQ.092 enquanto ela não estiver finalizada, concluída ou cancelada.' }, { status: 403 })
    }

    const fieldLabels = getRq092FieldLabels(solicitation.tipo.schemaJson)
    const allowedFieldNames = new Set(fieldLabels.keys())
    const previousPayload = normalizeSolicitationPayload(solicitation.payload)
    const previousCampos = asRecord(previousPayload.campos)
    const nextCampos = { ...previousCampos }
    const changes: Array<{ fieldName: string; label: string; oldValue: unknown; newValue: unknown }> = []

    for (const [fieldName, newValue] of Object.entries(requestedCampos)) {
      if (!allowedFieldNames.has(fieldName)) continue
      const oldValue = previousCampos[fieldName] ?? null
      if (valuesAreEqual(oldValue, newValue)) continue
      nextCampos[fieldName] = newValue
      changes.push({
        fieldName,
        label: fieldLabels.get(fieldName) ?? fieldName,
        oldValue,
        newValue: newValue ?? null,
      })
    }

    if (changes.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo foi alterado.' }, { status: 400 })
    }

    const editedAt = new Date()
    const actorName = me.fullName ?? me.email ?? me.login ?? me.id
    const correctionMetadata = {
      type: 'RQ092_CORRECAO_REALIZADA',
      solicitationId: solicitation.id,
      protocolo: solicitation.protocolo,
      actorId: me.id,
      actorName,
      actorLogin: me.login ?? null,
      actorEmail: me.email ?? null,
      editedAt: editedAt.toISOString(),
      justification,
      changes,
    }
    const timelineMessage = buildRq092CorrectionTimelineMessage({
      actorName,
      changes,
      justification,
    })

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSolicitation = await tx.solicitation.update({
        where: { id: solicitation.id },
        data: {
          payload: {
            ...previousPayload,
            campos: nextCampos,
          } as Prisma.InputJsonValue,
        },
        include: { tipo: true },
      })

      await tx.solicitationTimeline.create({
        data: {
          solicitationId: solicitation.id,
          status: 'RQ092_CORRECAO_REALIZADA',
          message: timelineMessage,
          createdAt: editedAt,
        },
      })

      await tx.event.create({
        data: {
          id: crypto.randomUUID(),
          solicitationId: solicitation.id,
          actorId: me.id,
          tipo: 'RQ092_CORRECAO_REALIZADA',
          createdAt: editedAt,
        },
      })

      return updatedSolicitation
    })

    return NextResponse.json({
      ok: true,
      solicitation: updated,
      correction: correctionMetadata,
    })
  } catch (error) {
    await registerAppError({
      area: 'solicitacoes',
      route: '/api/solicitacoes/[id]/corrigir-rq092',
      method: 'PATCH',
      userId,
      userLogin,
      message: 'Erro ao corrigir RQ.092',
      error,
      statusCode: 500,
      metadata: {
        solicitationId,
      },
    })

    console.error('❌ PATCH /api/solicitacoes/[id]/corrigir-rq092 error:', error)
    return NextResponse.json({ error: 'Erro ao corrigir a RQ.092.' }, { status: 500 })
  }
}
