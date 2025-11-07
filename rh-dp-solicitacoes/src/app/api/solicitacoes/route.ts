import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Status, Setor } from '@prisma/client' // Setor é o enum do seu schema (RH, DP, TI, etc.)

// ---------- utils ----------
function parseDateOnly(d?: string | null) {
  if (!d) return undefined
  // aceita "YYYY-MM-DD" ou "DD/MM/YYYY"
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return undefined
}

function asEnum<T>(val: any, E: Record<string, any>): T | undefined {
  if (!val) return undefined
  return (Object.values(E) as any[]).includes(val) ? (val as T) : undefined
}

// =============== GET /api/solicitacoes =================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '10')))
    const skip = (page - 1) * pageSize

    // filtros
    const scope = searchParams.get('scope') // 'sent' | 'received' | null
    const dateStart = parseDateOnly(searchParams.get('dateStart'))
    const dateEnd = parseDateOnly(searchParams.get('dateEnd'))
    const centerId = searchParams.get('centerId') // mapeia para enum Setor (setorDestino)
    const tipoId = searchParams.get('tipoId')
    const categoriaId = searchParams.get('categoriaId') // se não usar, ignore
    const protocolo = searchParams.get('protocolo')
    const solicitante = searchParams.get('solicitante')
    const statusParam = searchParams.get('status') // string -> Status
    const text = searchParams.get('text')

    // TODO: pegar o user da sessão quando ligar a auth
    const currentUserId: string | undefined = undefined

    const where: any = {}

    // escopo
    if (scope === 'sent' && currentUserId) where.autorId = currentUserId
    if (scope === 'received' && currentUserId) where.responsavelId = currentUserId

    // datas
    if (dateStart || dateEnd) {
      where.createdAt = {}
      if (dateStart) where.createdAt.gte = new Date(`${dateStart}T00:00:00`)
      if (dateEnd) where.createdAt.lte = new Date(`${dateEnd}T23:59:59`)
    }

    if (tipoId) where.tipoId = tipoId

    // centro -> enum Setor (ajuste o nome do enum se diferente)
    if (centerId) {
      const setorEnum = asEnum<Setor>(centerId, Setor as any)
      if (setorEnum) where.setorDestino = setorEnum
    }

    // status -> enum Status
    if (statusParam && statusParam !== 'TODOS') {
      const s = asEnum<Status>(statusParam, Status as any)
      if (s) where.status = s
    }

    if (protocolo) where.protocolo = { contains: protocolo, mode: 'insensitive' }

    if (solicitante) {
      where.autor = {
        OR: [
          { fullName: { contains: solicitante, mode: 'insensitive' } },
          { email: { contains: solicitante, mode: 'insensitive' } },
        ],
      }
    }

    if (text) {
      where.OR = [
        { titulo: { contains: text, mode: 'insensitive' } },
        { descricao: { contains: text, mode: 'insensitive' } },
      ]
    }

    // opcional: filtrar por categoria do tipo
    if (categoriaId) {
      where.tipo = { // usa relation filter
        categoria: { equals: categoriaId }
      }
    }

    const [total, rows] = await Promise.all([
      prisma.solicitation.count({ where }),
      prisma.solicitation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          tipo: { select: { nome: true, categoria: true } },
          responsavel: { select: { fullName: true } },
          autor: { select: { fullName: true, email: true } },
        },
      }),
    ])

    return NextResponse.json({ rows, total })
  } catch (e) {
    console.error('GET /api/solicitacoes error', e)
    return NextResponse.json({ rows: [], total: 0 }, { status: 500 })
  }
}

// =============== POST /api/solicitacoes =================
// usado pelo formulário "Nova Solicitação"
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      titulo,
      descricao,
      setorDestino,   // deve ser um valor do enum Setor (ex.: "RH", "TI", ...)
      tipoId,         // FK de TipoSolicitacao
      autorId,        // TODO: pegar da sessão
      payload,
    } = body ?? {}

    if (!autorId || !setorDestino || !tipoId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: autorId, setorDestino e tipoId.' },
        { status: 400 }
      )
    }

    // valida enum de setor
    const setorEnum = asEnum<Setor>(setorDestino, Setor as any)
    if (!setorEnum) {
      return NextResponse.json({ error: 'setorDestino inválido.' }, { status: 400 })
    }

    // gera um protocolo simples (opcional; adapte ao seu padrão)
    const protocolo = `RQ_${Date.now()}`

    const created = await prisma.solicitation.create({
      data: {
        titulo: titulo ?? 'Solicitação',
        descricao: descricao ?? '',
        setorDestino: setorEnum,
        status: Status.ABERTA,
        autorId,
        tipoId,
        protocolo,
        payload: payload ?? {},
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /api/solicitacoes error', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
