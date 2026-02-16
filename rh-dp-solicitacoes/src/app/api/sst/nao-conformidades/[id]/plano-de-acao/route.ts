import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    if (!hasMinLevel(normalizeSstLevel(levels), ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Nível 2 é obrigatório para gerenciar plano de ação.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const actions = Array.isArray(body?.actions) ? body.actions : []
    const id = (await params).id

    if (actions.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos uma ação.' }, { status: 400 })
    }

    const exists = await prisma.nonConformity.findUnique({ where: { id }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })

    const saved = await prisma.$transaction(async (tx) => {
      const out = []
      for (const action of actions) {
        const payload = {
          nonConformityId: id,
          descricao: String(action?.descricao || '').trim(),
          responsavelId: action?.responsavelId ? String(action.responsavelId) : null,
          responsavelNome: action?.responsavelNome ? String(action.responsavelNome).trim() : null,
          prazo: action?.prazo ? new Date(action.prazo) : null,
          status: Object.values(NonConformityActionStatus).includes(action?.status)
            ? action.status
            : NonConformityActionStatus.PENDENTE,
          evidencias: action?.evidencias ? String(action.evidencias).trim() : null,
        }

        if (!payload.descricao) continue

        const row = action?.id
          ? await tx.nonConformityActionItem.update({ where: { id: String(action.id) }, data: payload })
          : await tx.nonConformityActionItem.create({ data: payload })
        out.push(row)
      }

      await tx.nonConformityTimeline.create({
        data: {
          nonConformityId: id,
          actorId: me.id,
          tipo: 'PLANO_ACAO',
          message: 'Plano de ação atualizado',
        },
      })

      return out
    })

    return NextResponse.json({ items: saved })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades/[id]/plano-de-acao error', error)
    return NextResponse.json({ error: 'Erro ao salvar plano de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}