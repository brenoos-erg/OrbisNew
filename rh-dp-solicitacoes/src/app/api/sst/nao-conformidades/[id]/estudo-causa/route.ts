import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { devErrorDetail } from '@/lib/apiError'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Sem permissão no módulo SST.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const causaRaiz = body?.causaRaiz ? String(body.causaRaiz).trim() : null
    const items = Array.isArray(body?.items) ? body.items : []
    const id = (await params).id

    const nc = await prisma.nonConformity.findUnique({ where: { id }, select: { solicitanteId: true, aprovadoQualidadeStatus: true } })
    if (!nc) return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    if (nc.aprovadoQualidadeStatus !== 'APROVADO') {
      return NextResponse.json({ error: 'Estudo de causa só pode ser preenchido após aprovação da qualidade.' }, { status: 403 })
    }
    if (nc.solicitanteId !== me.id && !hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      return NextResponse.json({ error: 'Sem permissão para editar estudo de causa.' }, { status: 403 })
    }

    const saved = await prisma.$transaction(async (tx) => {
      await tx.nonConformityCauseItem.deleteMany({ where: { nonConformityId: id } })

      const rows = []
      for (let idx = 0; idx < items.length; idx += 1) {
        const item = items[idx]
        const pergunta = String(item?.pergunta || `Por quê ${idx + 1}?`).trim()
        const resposta = item?.resposta ? String(item.resposta).trim() : null

        rows.push(await tx.nonConformityCauseItem.create({
          data: {
            nonConformityId: id,
            ordem: idx + 1,
            pergunta,
            resposta,
          },
        }))
      }

      await tx.nonConformity.update({ where: { id }, data: { causaRaiz } })
      await tx.nonConformityTimeline.create({
        data: {
          nonConformityId: id,
          actorId: me.id,
          tipo: 'ESTUDO_CAUSA',
          message: 'Estudo de causa atualizado',
        },
      })
      return rows
    })

    return NextResponse.json({ items: saved })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar estudo de causa.', detail: devErrorDetail(error) }, { status: 500 })
  }
}