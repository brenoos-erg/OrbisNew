import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

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
 * Lista solicitações com filtros e paginação.
 * Responde no formato { rows, total } que a tela de "Solicitações Enviadas" espera.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const page = Math.max(
      1,
      Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    )
    const pageSize =
      Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10

    const skip = (page - 1) * pageSize

    const where = buildWhereFromSearchParams(searchParams)

    const scope = searchParams.get('scope') // sent, to-approve, etc.

    // 👉 Aqui vamos tratar o painel de aprovação
    if (scope === 'to-approve') {
      // TODO: PEGAR usuário logado de verdade (Supabase / Auth do seu projeto)
      // Exemplo: const userId = getCurrentUserIdFromRequest(req)
      const userId = searchParams.get('userId') // provisório para teste

      if (!userId) {
        return NextResponse.json(
          { error: 'Usuário não identificado para painel de aprovação.' },
          { status: 401 },
        )
      }

      // Só solicitações que precisam de aprovação e estão pendentes
      where.requiresApproval = true
      where.approvalStatus = 'PENDENTE'

      // Regra: aprovador é o usuário atual
      where.approverId = userId
    }


    // FUTURO: se quiser filtrar por "scope=sent" (somente as enviadas pelo usuário logado),
    // você pode ler o usuário logado aqui e aplicar where.solicitanteId = user.id

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
          solicitante: { select: { id: true, fullName: true } },
        },
      }),
      prisma.solicitation.count({ where }),
    ])

    const rows = solicitations.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      status: s.status, // enum -> string
      protocolo: s.protocolo,
      createdAt: s.dataAbertura.toISOString(),
      tipo: s.tipo ? { nome: s.tipo.nome } : null,
      responsavelId: s.approver?.id ?? null,
      responsavel: s.approver ? { fullName: s.approver.fullName } : null,
      autor: s.solicitante
        ? { fullName: s.solicitante.fullName }
        : null,
      sla: null, // se quiser, depois adiciona um campo SLA na tabela
      setorDestino: s.department?.name ?? null,
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
 * POST /api/solicitacoes
 * Cria uma nova solicitação.
 * Espera corpo no formato:
 * {
 *   tipoId: string,
 *   costCenterId: string,
 *   departmentId: string,
 *   solicitanteId: string,
 *   payload: any  // { campos: {...}, solicitante: {...} }
 * }
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
        { error: 'Tipo, centro de custo, departamento e solicitante são obrigatórios.' },
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

    // Título padrão: nome do tipo de solicitação
    const titulo = tipo.nome
    const descricao = null

    // 1) cria a solicitação básica
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
        // demais campos usam defaults (status = ABERTA, etc.)
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
      const vagaPrevista = payload?.campos?.vagaPrevistaContrato as
        | string
        | undefined

      if (vagaPrevista === 'Sim') {
        // ✅ Vaga prevista em contrato -> aprovação automática
        const updated = await prisma.solicitation.update({
          where: { id: created.id },
          data: {
            requiresApproval: false,
            approvalStatus: 'APROVADO',
            status: 'EM_ATENDIMENTO', // RH já pode tocar
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

      if (vagaPrevista === 'Não') {
        // ❗ Não prevista em contrato -> precisa aprovação Vidal/Lorena
        const vidal = await prisma.user.findUnique({
          where: { email: 'eduardo.vidal@ergengenharia.com.br' }, // ajuste se o e-mail for outro
        })

        const lorena = await prisma.user.findUnique({
          where: { email: 'lorena.oliveira@ergengenharia.com.br' }, // ajuste se o e-mail for outro
        })

        const approverId = vidal?.id ?? lorena?.id ?? null

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

    // Se não for RQ_063 (ou não tiver o campo vagaPrevistaContrato), devolve a criada normal
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    console.error('POST /api/solicitacoes error', e)
    return NextResponse.json(
      { error: 'Erro ao registrar a solicitação.' },
      { status: 500 },
    )
  }
}
