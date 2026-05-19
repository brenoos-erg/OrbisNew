import { NextRequest, NextResponse } from 'next/server'
import { Action, ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'
import { canManageAllNc } from '@/lib/sst/nonConformity'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Sem permissão no módulo SST.' }, { status: 403 })
    }
    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.ESTUDO_DE_CAUSA, Action.UPDATE)

    const body = await req.json().catch(() => ({} as any))
    const hasCausaRaiz = body?.causaRaiz !== undefined
    const causaRaiz = hasCausaRaiz ? (body?.causaRaiz ? String(body.causaRaiz).trim() : null) : undefined
    const incomingItems = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.fiveWhys)
        ? body.fiveWhys
        : Array.isArray(body?.whyAnalysis)
          ? body.whyAnalysis
          : []
    const hasItems = incomingItems.length > 0 || Array.isArray(body?.items) || Array.isArray(body?.fiveWhys) || Array.isArray(body?.whyAnalysis)
    const items = incomingItems
    const id = (await params).id

    const nc = await prisma.nonConformity.findUnique({ where: { id }, select: { solicitanteId: true, aprovadoQualidadeStatus: true } })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (nc.aprovadoQualidadeStatus !== 'APROVADO' && !canManageAllNc(level)) {
      return NextResponse.json({ error: 'Estudo de causa só pode ser preenchido após aprovação da qualidade.' }, { status: 403 })
    }
    if (nc.solicitanteId !== me.id && !hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Sem permissão para editar estudo de causa.' }, { status: 403 })
    }

    const saved = await prisma.$transaction(async (tx) => {
      const rows = []
      if (hasItems) {
        await tx.nonConformityCauseItem.deleteMany({ where: { nonConformityId: id } })
        for (let idx = 0; idx < items.length; idx += 1) {
          const item = items[idx]
          const pergunta = String(item?.pergunta || item?.question || `Por quê ${idx + 1}?`).trim()
          const respostaRaw = item?.resposta ?? item?.answer ?? item?.why ?? null
          const resposta = respostaRaw !== null && respostaRaw !== undefined ? String(respostaRaw).trim() : null

          rows.push(await tx.nonConformityCauseItem.create({
            data: {
              nonConformityId: id,
              ordem: idx + 1,
              pergunta,
              resposta,
            },
          }))
        }
      }

      const normalizedCauseItems = rows.map((row) => ({ ordem: row.ordem, pergunta: row.pergunta, resposta: row.resposta }))
      const fallbackRootCause = body?.rootCause ?? body?.rootCauseAnalysis ?? body?.observacaoFinal ?? body?.descricaoFinal
      const normalizedRootCause = hasCausaRaiz
        ? causaRaiz
        : fallbackRootCause !== undefined
          ? (fallbackRootCause ? String(fallbackRootCause).trim() : null)
          : undefined

      if (normalizedRootCause !== undefined || hasItems) {
        await tx.nonConformity.update({
          where: { id },
          data: {
            ...(normalizedRootCause !== undefined ? { causaRaiz: normalizedRootCause } : {}),
            ...(hasItems ? { rootCauseAnalysis: normalizedCauseItems as any } : {}),
          },
        })
      }
       await appendNonConformityTimelineEvent(tx, {
        nonConformityId: id,
        actorId: me.id,
        tipo: 'ESTUDO_CAUSA',
        message: 'Estudo de causa atualizado',
      })
      return { rows, rootCauseAnalysis: hasItems ? normalizedCauseItems : [] }
    })

    return NextResponse.json({ ok: true, nonConformityId: id, rootCauseAnalysis: saved.rootCauseAnalysis, items: saved.rows })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar estudo de causa.', detail: devErrorDetail(error) }, { status: 500 })
  }
}
