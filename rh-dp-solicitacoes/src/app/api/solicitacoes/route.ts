// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Gera um código de protocolo simples, ex: RQ2502-0001
 * Ajuste se quiser outro padrão.
 */
function generateProtocolo() {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9999)
    .toString()
    .padStart(4, '0')
  return `RQ${yy}${mm}${dd}-${rand}`
}

/**
 * Monta o objeto `where` para o Prisma a partir dos filtros da query string
 */
function buildWhereFromSearchParams(searchParams: URLSearchParams) {
  const where: any = {}

  const dateStart = searchParams.get('dateStart')
  const dateEnd = searchParams.get('dateEnd')
  const centerId = searchParams.get('centerId')
  const tipoId = searchParams.get('tipoId')
  const protocolo = searchParams.get('protocolo')
  const solicitante = searchParams.get('solicitante')
  const status = searchParams.get('status')
  const text = searchParams.get('text')

  // Período de abertura
  if (dateStart || dateEnd) {
    where.dataAbertura = {}
    if (dateStart) {
      where.dataAbertura.gte = new Date(dateStart + 'T00:00:00')
    }
    if (dateEnd) {
      // adiciona 1 dia para incluir o dia final inteiro
      const end = new Date(dateEnd + 'T23:59:59')
      where.dataAbertura.lte = end
    }
  }

  if (centerId) {
    where.costCenterId = centerId
  }

  if (tipoId) {
    where.tipoId = tipoId
  }

  if (status) {
    // precisa bater com o enum SolicitationStatus
    where.status = status
  }

  if (protocolo) {
    where.protocolo = {
      contains: protocolo,
      mode: 'insensitive',
    }
  }

  if (solicitante) {
    where.solicitante = {
      OR: [
        {
          fullName: {
            contains: solicitante,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: solicitante,
            mode: 'insensitive',
          },
        },
      ],
    }
  }

  if (text) {
    const or: any[] = [
      {
        titulo: {
          contains: text,
          mode: 'insensitive',
        },
      },
      {
        descricao: {
          contains: text,
          mode: 'insensitive',
        },
      },
    ]
    if (where.OR) {
      where.OR = [...where.OR, ...or]
    } else {
      where.OR = or
    }
  }

  return where
}

/**
 * GET /api/solicitacoes
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser()

    const { searchParams } = new URL(req.url)

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    )
    const pageSize =
      Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10

    const skip = (page - 1) * pageSize

    const where = buildWhereFromSearchParams(searchParams)

    const scope = searchParams.get('scope') ?? 'sent' // sent, received, to-approve, etc.

    /**
     * ESCOPOS
     * sent      -> solicitações que EU abri
     * received  -> solicitações para os MEUS centros de custo
     * to-approve-> solicitações pendentes de aprovação por MIM
     */

    if (scope === 'sent') {
      where.solicitanteId = me.id
    } else if (scope === 'received') {
      const ccIds = new Set<string>()

      if (me.costCenterId) {
        ccIds.add(me.costCenterId)
      }

      const links = await prisma.userCostCenter.findMany({
        where: { userId: me.id },
        select: { costCenterId: true },
      })

      for (const l of links) {
        ccIds.add(l.costCenterId)
      }

      if (ccIds.size === 0) {
        where.id = '__never__' as any
      } else {
        where.costCenterId = { in: [...ccIds] }
      }
    } else if (scope === 'to-approve') {
      where.requiresApproval = true
      where.approvalStatus = 'PENDENTE'
      where.approverId = me.id
    }

    const [solicitations, total] = await Promise.all([
      prisma.solicitation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dataAbertura: 'desc' },
        include: {
          tipo: { select: { nome: true } },
          department: { select: { name: true } },
          approver: { select: { id: true, fullName: true } },
          assumidaPor: { select: { id: true, fullName: true } },
          solicitante: { select: { id: true, fullName: true } },
        },
      }),
      prisma.solicitation.count({ where }),
    ])

    const rows = solicitations.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status,
      protocolo: s.protocolo,
      createdAt: s.dataAbertura.toISOString(),
      tipo: s.tipo ? { nome: s.tipo.nome } : null,

      responsavelId: s.assumidaPor?.id ?? null,
      responsavel: s.assumidaPor ? { fullName: s.assumidaPor.fullName } : null,

      autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,

      sla: null,
      setorDestino: s.department?.name ?? null,

      requiresApproval: s.requiresApproval,
      approvalStatus: s.approvalStatus,
    }))

    return NextResponse.json({
      rows,
      total,
    })
  } catch (e) {
    console.error('GET /api/solicitacoes error', e)
    return NextResponse.json(
      { error: 'Erro ao listar solicitações.' },
      { status: 500 },
    )
  }
}

/**
 * Acha o aprovador: usuário nível 3 vinculado ao centro de custo.
 * Se não encontrar ninguém nesse centro, pega qualquer usuário nível 3.
 *
 * ⚠️ Ajuste o nome do campo de nível na tabela User se for diferente de "level".
 */
async function findLevel3ApproverForCostCenter(costCenterId: string) {
  // primeiro, usuários vinculados ao centro de custo
  const links = await prisma.userCostCenter.findMany({
    where: { costCenterId },
    include: {
      user: true,
    },
  })

  const level3FromCC = links
    .map((l) => l.user)
    .find((u: any) => u && u.level === 3) // <-- ajuste "level" se o campo tiver outro nome

  if (level3FromCC) return level3FromCC

  // fallback: qualquer usuário nível 3
  const fallback = await prisma.user.findFirst({
    where: { level: 3 }, // <-- ajuste "level" se precisar
  })

  return fallback
}

/**
 * POST /api/solicitacoes
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const tipoId = body.tipoId as string | undefined
    const costCenterId = body.costCenterId as string | undefined
    const departmentId = body.departmentId as string | undefined
    const solicitanteId = body.solicitanteId as string | undefined
    const payload = body.payload ?? {}

    if (!tipoId || !costCenterId || !departmentId || !solicitanteId) {
      return NextResponse.json(
        {
          error:
            'Tipo, centro de custo, departamento e solicitante são obrigatórios.',
        },
        { status: 400 },
      )
    }

    const tipo = await prisma.tipoSolicitacao.findUnique({
      where: { id: tipoId },
    })

    if (!tipo) {
      return NextResponse.json(
        { error: 'Tipo de solicitação não encontrado.' },
        { status: 400 },
      )
    }

    const protocolo = generateProtocolo()

    const titulo = tipo.nome
    const descricao = null

    // 1) cria a solicitação básica (status default = ABERTA)
    const created = await prisma.solicitation.create({
      data: {
        protocolo,
        tipoId,
        costCenterId,
        departmentId,
        solicitanteId,
        titulo,
        descricao,
        payload,
      },
    })

    // 2) registra evento de criação
    await prisma.event.create({
      data: {
        id: crypto.randomUUID(),
        solicitationId: created.id,
        actorId: solicitanteId,
        tipo: 'CRIACAO',
      },
    })

    // 3) Regras específicas para RQ_063 - Solicitação de Pessoal
    if (tipo.nome === 'RQ_063 - Solicitação de Pessoal') {
      // front manda: campos.vagaPrevista = 'SIM' | 'NAO'
      const raw = payload?.campos?.vagaPrevista as string | undefined
      const vagaPrevista = raw?.toUpperCase()

      if (vagaPrevista === 'SIM') {
        // vaga já prevista em contrato -> não precisa aprovação
        const updated = await prisma.solicitation.update({
          where: { id: created.id },
          data: {
            requiresApproval: false,
            approvalStatus: 'APROVADO',
            approvalAt: new Date(),
            approverId: null,
            status: 'ABERTA', // já vai direto para atendimento
          },
        })

        await prisma.event.create({
          data: {
            id: crypto.randomUUID(),
            solicitationId: created.id,
            actorId: solicitanteId,
            tipo: 'APROVACAO_AUTOMATICA_CONTRATO',
          },
        })

        return NextResponse.json(updated, { status: 201 })
      }

      if (vagaPrevista === 'NAO') {
        // NÃO prevista em contrato -> precisa passar para o usuário nível 3
        const approver = await findLevel3ApproverForCostCenter(costCenterId)
        const approverId = approver?.id ?? null

        const updated = await prisma.solicitation.update({
          where: { id: created.id },
          data: {
            requiresApproval: true,
            approvalStatus: 'PENDENTE',
            approverId,
            status: 'AGUARDANDO_APROVACAO',
          },
        })

        await prisma.event.create({
          data: {
            id: crypto.randomUUID(),
            solicitationId: created.id,
            actorId: approverId ?? solicitanteId,
            tipo: 'AGUARDANDO_APROVACAO_GESTOR',
          },
        })

        return NextResponse.json(updated, { status: 201 })
      }
    }

    // Se não for RQ_063 (ou não tiver o campo vagaPrevista), devolve a criada normal
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /api/solicitacoes error', e)
    return NextResponse.json(
      { error: 'Erro ao registrar a solicitação.' },
      { status: 500 },
    )
  }
}
