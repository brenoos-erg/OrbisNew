import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, NonConformityActionStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function toDateOnly(dateValue?: string | null) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const status = searchParams.get('status')
    const responsavel = searchParams.get('responsavel')?.trim()
    const emAtraso = searchParams.get('emAtraso') === '1'

    const where: Prisma.NonConformityActionItemWhereInput = {
      ...(status && Object.values(NonConformityActionStatus).includes(status as NonConformityActionStatus)
        ? { status: status as NonConformityActionStatus }
        : {}),
      ...(responsavel
        ? {
            responsavelNome: {
              contains: responsavel,
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { descricao: { contains: q } },
              { evidencias: { contains: q } },
              { nonConformity: { numeroRnc: { contains: q } } },
            ],
          }
        : {}),
    }

    if (!hasMinLevel(level, ModuleLevel.NIVEL_2)) {
      where.nonConformity = {
        solicitanteId: me.id,
      }
    }

    const items = await prisma.nonConformityActionItem.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        descricao: true,
        responsavelNome: true,
        prazo: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        nonConformityId: true,
        nonConformity: {
          select: {
            id: true,
            numeroRnc: true,
            status: true,
            centroQueOriginou: { select: { description: true } },
            centroQueDetectou: { select: { description: true } },
          },
        },
      },
    })

    const today = toDateOnly(new Date().toISOString())
    const filtered = emAtraso
      ? items.filter((item) => {
          const prazo = toDateOnly(item.prazo?.toISOString())
          if (!prazo || !today) return false
          if (item.status === NonConformityActionStatus.CONCLUIDA || item.status === NonConformityActionStatus.CANCELADA) {
            return false
          }
          return prazo < today
        })
      : items

    return NextResponse.json({ items: filtered })
  } catch (error) {
    console.error('GET /api/sst/planos-de-acao error', error)
    return NextResponse.json({ error: 'Erro ao listar planos de ação.', detail: devErrorDetail(error) }, { status: 500 })
  }
}