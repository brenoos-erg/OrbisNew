import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { canFeature, getUserModuleLevel } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { registerAppError } from '@/lib/errorRegistry'

type Change = {
  fieldName: string
  label: string
  oldValue: string | null
  newValue: string | null
}

function textValue(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text.length ? text : null
}

function pushChange(changes: Change[], fieldName: string, label: string, oldValue: unknown, newValue: unknown) {
  const oldText = textValue(oldValue)
  const newText = textValue(newValue)
  if (oldText !== newText) changes.push({ fieldName, label, oldValue: oldText, newValue: newText })
}

function debugCauseStudy(message: string, metadata: Record<string, unknown>) {
  if (process.env.DEBUG_NC_CAUSE_STUDY === 'true') {
    console.info(`[estudo-causa] ${message}`, metadata)
  }
}

function canEditCauseStudyFromVisibleNc({
  effectiveLevel,
  canViewNonConformities,
  ncStatus,
}: {
  userId: string
  effectiveLevel: ModuleLevel | undefined
  canViewNonConformities: boolean
  ncStatus: string
}) {
  if (!hasMinLevel(effectiveLevel, ModuleLevel.NIVEL_1)) return { allowed: false, reason: 'missing_minimum_sst_level' }
  if (!canViewNonConformities) return { allowed: false, reason: 'missing_non_conformities_view' }
  if (ncStatus === 'CANCELADA' || ncStatus === 'ENCERRADA') return { allowed: false, reason: 'final_status' }
  return { allowed: true, reason: 'allowed' }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let id: string | undefined
  let userId: string | undefined
  let userLogin: string | null | undefined

  try {
    const me = await requireActiveUser()
    userId = me.id
    userLogin = me.login
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)
    const sstLevel = await getUserModuleLevel(me.id, MODULE_KEYS.SST)
    const effectiveLevel = sstLevel ?? level ?? undefined

    const hasSstModuleAccess = hasMinLevel(effectiveLevel, ModuleLevel.NIVEL_1)
    debugCauseStudy('contexto de permissão inicial', {
      userId: me.id,
      userLogin: me.login,
      effectiveLevel,
      hasSstModuleAccess,
    })

    if (!hasSstModuleAccess) {
      debugCauseStudy('bloqueio de permissão', {
        userId: me.id,
        userLogin: me.login,
        effectiveLevel,
        hasSstModuleAccess,
        reason: 'missing_minimum_sst_level',
      })
      return NextResponse.json({ error: 'Sem permissão no módulo SST.', reason: 'missing_minimum_sst_level' }, { status: 403 })
    }

    const canViewNonConformities = await canFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.NAO_CONFORMIDADES, Action.VIEW)
    debugCauseStudy('acesso à tela de não conformidades verificado', {
      userId: me.id,
      userLogin: me.login,
      effectiveLevel,
      hasSstModuleAccess,
      canViewNonConformities,
    })
    if (!canViewNonConformities) {
      debugCauseStudy('bloqueio de permissão', {
        userId: me.id,
        userLogin: me.login,
        effectiveLevel,
        hasSstModuleAccess,
        canViewNonConformities,
        reason: 'missing_non_conformities_view',
      })
      return NextResponse.json({ error: 'Sem permissão para visualizar Não Conformidades.', reason: 'missing_non_conformities_view' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const normalizeCauseStudyPayload = (payload: any) => {
      const questions = Array.isArray(payload?.questions) ? payload.questions : []
      const answers = Array.isArray(payload?.answers) ? payload.answers : []
      const legacyItems = Array.from({ length: 20 }).map((_, idx) => ({
        question: payload?.[`porque${idx + 1}`] !== undefined ? `Por quê ${idx + 1}?` : undefined,
        answer: payload?.[`porque${idx + 1}`],
      }))
      const incomingItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.fiveWhys)
          ? payload.fiveWhys
          : Array.isArray(payload?.whyAnalysis)
            ? payload.whyAnalysis
            : questions.length > 0 || answers.length > 0
              ? Array.from({ length: Math.max(questions.length, answers.length) }).map((_, idx) => ({
                question: questions[idx],
                answer: answers[idx],
              }))
              : legacyItems

      const hasItems = incomingItems.some((item: any) => item?.question !== undefined || item?.pergunta !== undefined || item?.answer !== undefined || item?.resposta !== undefined || item?.why !== undefined)
      const normalizedItems = incomingItems.map((item: any, idx: number) => ({
        question: String(item?.question ?? item?.pergunta ?? `Por quê ${idx + 1}?`).trim(),
        answer: item?.answer ?? item?.resposta ?? item?.why ?? null,
      }))
      const rootCauseRaw = payload?.causaRaiz ?? payload?.rootCause ?? payload?.observacaoFinal ?? payload?.descricaoFinal ?? payload?.notes
      const hasRootCause = rootCauseRaw !== undefined
      const rootCause = hasRootCause ? (rootCauseRaw ? String(rootCauseRaw).trim() : null) : undefined

      return { hasItems, normalizedItems, hasRootCause, rootCause }
    }

    const normalized = normalizeCauseStudyPayload(body)
    id = (await params).id
    const nonConformityId = id
    debugCauseStudy('payload normalizado', {
      userId: me.id,
      userLogin: me.login,
      effectiveLevel,
      hasSstModuleAccess,
      canViewNonConformities,
      nonConformityId,
      hasItems: normalized.hasItems,
      itemsCount: normalized.normalizedItems.length,
      hasRootCause: normalized.hasRootCause,
    })

    const nc = await prisma.nonConformity.findUnique({
      where: { id: nonConformityId },
      select: {
        status: true,
        causaRaiz: true,
        estudoCausa: { orderBy: { ordem: 'asc' } },
      },
    })
    if (!nc) {
      debugCauseStudy('bloqueio de permissão', {
        userId: me.id,
        userLogin: me.login,
        effectiveLevel,
        hasSstModuleAccess,
        canViewNonConformities,
        nonConformityId,
        reason: 'not_found',
      })
      return NextResponse.json({ error: 'Não conformidade não encontrada.', reason: 'not_found' }, { status: 404 })
    }

    const hasFinalStatus = nc.status === 'CANCELADA' || nc.status === 'ENCERRADA'
    const editAccess = canEditCauseStudyFromVisibleNc({
      userId: me.id,
      effectiveLevel,
      canViewNonConformities,
      ncStatus: nc.status,
    })
    debugCauseStudy('decisão de permissão', {
      userId: me.id,
      userLogin: me.login,
      effectiveLevel,
      hasSstModuleAccess,
      canViewNonConformities,
      nonConformityId,
      status: nc.status,
      hasFinalStatus,
      allowed: editAccess.allowed,
      reason: editAccess.reason,
    })
    if (!editAccess.allowed) {
      const isFinalStatus = editAccess.reason === 'final_status'
      return NextResponse.json(
        {
          error: isFinalStatus
            ? 'Não é possível editar estudo de causa em RNC cancelada ou encerrada.'
            : 'Sem permissão para editar estudo de causa.',
          reason: editAccess.reason,
        },
        { status: isFinalStatus ? 409 : 403 },
      )
    }
    const changes: Change[] = []
    const maxItems = Math.max(nc.estudoCausa.length, normalized.hasItems ? normalized.normalizedItems.length : 0)
    if (normalized.hasItems) {
      for (let idx = 0; idx < maxItems; idx += 1) {
        const oldItem = nc.estudoCausa[idx]
        const newItem = normalized.normalizedItems[idx]
        pushChange(changes, `porque${idx + 1}.pergunta`, `Porquê ${idx + 1} - pergunta`, oldItem?.pergunta, newItem?.question ?? `Por quê ${idx + 1}?`)
        pushChange(changes, `porque${idx + 1}.resposta`, `Porquê ${idx + 1} - resposta`, oldItem?.resposta, newItem?.answer)
      }
    }
    if (normalized.rootCause !== undefined) {
      pushChange(changes, 'causaRaiz', 'Causa raiz', nc.causaRaiz, normalized.rootCause)
    }

    const saved = await prisma.$transaction(async (tx) => {
      const rows = []
      if (normalized.hasItems) {
        await tx.nonConformityCauseItem.deleteMany({ where: { nonConformityId } })
        for (let idx = 0; idx < normalized.normalizedItems.length; idx += 1) {
          const item = normalized.normalizedItems[idx]
          const pergunta = String(item?.question || `Por quê ${idx + 1}?`).trim()
          const respostaRaw = item?.answer ?? null
          const resposta = respostaRaw !== null && respostaRaw !== undefined ? String(respostaRaw).trim() : null

          rows.push(await tx.nonConformityCauseItem.create({
            data: {
              nonConformityId,
              ordem: idx + 1,
              pergunta,
              resposta,
            },
          }))
        }
      }

      const normalizedRootCause = normalized.rootCause

      if (normalizedRootCause !== undefined) {
        await tx.nonConformity.update({
          where: { id: nonConformityId },
          data: { causaRaiz: normalizedRootCause },
        })
      }
      if (changes.length > 0) {
        await tx.nonConformityCauseStudyEditLog.create({
          data: {
            nonConformityId,
            actorId: me.id,
            actorName: me.fullName ?? null,
            actorEmail: me.email ?? null,
            actorLogin: me.login ?? null,
            changes,
          },
        })
        await appendNonConformityTimelineEvent(tx, {
          nonConformityId,
          actorId: me.id,
          tipo: 'ESTUDO_CAUSA',
          message: `Estudo de causa editado por ${me.fullName ?? me.login ?? 'usuário'}. Campos alterados: ${changes.length}.`,
        })
      }
      return { rows }
    })

    return NextResponse.json({ ok: true, unchanged: changes.length === 0, nonConformityId, items: saved.rows })
  } catch (error) {
    await registerAppError({
      area: 'sst',
      route: '/api/sst/nao-conformidades/[id]/estudo-causa',
      method: 'POST',
      userId,
      userLogin,
      message: 'Erro ao salvar estudo de causa',
      error,
      statusCode: 500,
      metadata: { nonConformityId: id },
    })

    if (process.env.NODE_ENV !== 'production') {
      console.error('[estudo-causa] erro ao salvar', error)
    }
    return NextResponse.json(
      { error: 'Erro ao salvar estudo de causa.', ...(process.env.NODE_ENV !== 'production' ? { detail: devErrorDetail(error) } : {}) },
      { status: 500 },
    )
  }
}
