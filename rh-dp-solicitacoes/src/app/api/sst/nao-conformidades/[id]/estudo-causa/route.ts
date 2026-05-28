import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature, getUserModuleLevel } from '@/lib/permissions'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { registerAppError } from '@/lib/errorRegistry'

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
    const hasSgiQualidadeLevel3 = hasMinLevel(sstLevel ?? level ?? undefined, ModuleLevel.NIVEL_3)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Sem permissão no módulo SST.' }, { status: 403 })
    }
    try {
      await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.ESTUDO_DE_CAUSA, Action.UPDATE)
    } catch {
      return NextResponse.json({ error: 'Sem permissão para editar estudo de causa.' }, { status: 403 })
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

    const nc = await prisma.nonConformity.findUnique({ where: { id: nonConformityId }, select: { solicitanteId: true, aprovadoQualidadeStatus: true } })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (nc.aprovadoQualidadeStatus !== 'APROVADO' && !hasSgiQualidadeLevel3) {
      return NextResponse.json({ error: 'Estudo de causa só pode ser preenchido após aprovação da qualidade.' }, { status: 403 })
    }
    if (nc.solicitanteId !== me.id && !hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Sem permissão para editar estudo de causa.' }, { status: 403 })
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
       await appendNonConformityTimelineEvent(tx, {
        nonConformityId,
        actorId: me.id,
        tipo: 'ESTUDO_CAUSA',
        message: 'Estudo de causa atualizado.',
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
