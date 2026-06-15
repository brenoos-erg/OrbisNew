import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { getUserModuleLevel } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { registerAppError } from '@/lib/errorRegistry'
import { canUserAccessNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'

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

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Sem permissão no módulo SST.' }, { status: 403 })
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
    if (process.env.NODE_ENV !== 'production') {
      console.info('[estudo-causa] payload normalizado', { nonConformityId, payload: normalized })
    }

    const nc = await prisma.nonConformity.findUnique({
      where: { id: nonConformityId },
      select: {
        solicitanteId: true,
        centroQueDetectouId: true,
        centroQueOriginouId: true,
        aprovadoQualidadeStatus: true,
        status: true,
        causaRaiz: true,
        estudoCausa: { orderBy: { ordem: 'asc' } },
      },
    })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (nc.status === 'CANCELADA' || nc.status === 'ENCERRADA') {
      return NextResponse.json({ error: 'Não é possível editar estudo de causa em RNC cancelada ou encerrada.' }, { status: 409 })
    }
    const userCostCenterIds = hasMinLevel(effectiveLevel, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canAccess = canUserAccessNc({
      userId: me.id,
      level: effectiveLevel,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canAccess) {
      return NextResponse.json({ error: 'Sem permissão para editar estudo de causa.' }, { status: 403 })
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
      }
      await appendNonConformityTimelineEvent(tx, {
        nonConformityId,
        actorId: me.id,
        tipo: 'ESTUDO_CAUSA',
        message: `Estudo de causa editado por ${me.fullName ?? me.login ?? 'usuário'}. Campos alterados: ${changes.length}.`,
      })
      return { rows }
    })

    return NextResponse.json({ ok: true, nonConformityId, items: saved.rows })
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
