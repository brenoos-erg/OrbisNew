export const dynamic = 'force-dynamic'
export const revalidate = 0

// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, SolicitationPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { withModuleLevel } from '@/lib/access'
import { performance } from 'node:perf_hooks'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  isSolicitacaoDesligamento,
  isSolicitacaoNadaConsta,
} from '@/lib/solicitationTypes'


/**
 * Gera um código de protocolo simples, ex: RQ2502-0001
 */
function generateProtocolo() {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).toString().padStart(2, '0')
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
  const costCenterId = searchParams.get('costCenterId') ?? centerId
  const departmentId = searchParams.get('departmentId')
  const tipoId = searchParams.get('tipoId')
  const protocolo = searchParams.get('protocolo')
  const solicitante = searchParams.get('solicitante')
  const status = searchParams.get('status')
  const text = searchParams.get('text')
  if (dateStart || dateEnd) {
    where.dataAbertura = {}
    if (dateStart) {
      where.dataAbertura.gte = new Date(dateStart + 'T00:00:00')
    }
    if (dateEnd) {
      const end = new Date(dateEnd + 'T23:59:59')
      where.dataAbertura.lte = end
    }
  }

  if (departmentId) where.departmentId = departmentId
  if (costCenterId) where.costCenterId = costCenterId
  if (tipoId) where.tipoId = tipoId
  if (status) where.status = status

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
          fullName: { contains: solicitante, mode: 'insensitive' },
        },
        {
          email: { contains: solicitante, mode: 'insensitive' },
        },
      ],
    }
  }

  if (text) {
    const or: any[] = [
      {
        titulo: { contains: text, mode: 'insensitive' },
      },
      {
        descricao: { contains: text, mode: 'insensitive' },
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
export const GET = withModuleLevel(
  'solicitacoes',
  ModuleLevel.NIVEL_1,
  async (req: NextRequest, ctx) => {
    return withRequestMetrics('GET /api/solicitacoes', async () => {
      try {
        const { me } = ctx
        const { searchParams } = new URL(req.url)

        const page = Math.max(
          1,
          Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
        )
        const pageSize =
          Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10

        const skip = (page - 1) * pageSize
        const where = buildWhereFromSearchParams(searchParams)

        const scope = searchParams.get('scope') ?? 'sent' // sent, received, to-approve

        if (scope === 'sent') {
          where.solicitanteId = me.id
        } else if (scope === 'received') {
          const ccIds = new Set<string>()
          const deptIds = new Set<string>()

          if (me.costCenterId) {
            ccIds.add(me.costCenterId)
          }

          if (me.departmentId) {
            deptIds.add(me.departmentId)
          }

          const links = await prisma.userCostCenter.findMany({
            where: { userId: me.id },
            select: { costCenterId: true },
          })

          for (const l of links) {
            ccIds.add(l.costCenterId)
          }

          const departmentLinks = await prisma.userDepartment.findMany({
            where: { userId: me.id },
            select: {
              departmentId: true,
              department: { select: { code: true } },
            },
          })

          for (const link of departmentLinks) {
            deptIds.add(link.departmentId)
          }

          const isDpUser =
            me.department?.code === '08' ||
            departmentLinks.some((link) => link.department?.code === '08')

          const dpDepartmentId =
            me.department?.code === '08'
              ? me.departmentId
              : departmentLinks.find((link) => link.department?.code === '08')
                  ?.departmentId

          const dpFilters =
            isDpUser && dpDepartmentId
              ? [{ costCenterId: null, departmentId: dpDepartmentId }]
              : []

          if (where.costCenterId) {
            if (!ccIds.has(where.costCenterId)) {
              where.id = '__never__' as any
            }
          } else {
            const receivedFilters = [
              ...(ccIds.size > 0 ? [{ costCenterId: { in: [...ccIds] } }] : []),
              ...(deptIds.size > 0
                ? [{ departmentId: { in: [...deptIds] } }]
                : []),
              ...dpFilters,
            ]

            if (receivedFilters.length === 0) {
              where.id = '__never__' as any
            } else {
              where.AND = [...(where.AND ?? []), { OR: receivedFilters }]
            }
          }
           // RQ_063 só deve chegar na fila após aprovação (nível 3)
          where.AND = [
            ...(where.AND ?? []),
            {
              NOT: {
                AND: [
                  { requiresApproval: true },
                  { approvalStatus: 'PENDENTE' },
                  {
                    OR: [
                      { tipo: { nome: 'RQ_063 - Solicitação de Pessoal' } },
                    ],
                  },
                ],
              },
            },
          ]
        } else if (scope === 'to-approve') {
          where.requiresApproval = true
          where.approvalStatus = 'PENDENTE'
          // se quiser filtrar por aprovador:
          // where.approverId = me.id
        }

        const listStartedAt = performance.now()
        const [solicitations, total] = await Promise.all([
          prisma.solicitation.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { dataAbertura: 'desc' },
            include: {
              tipo: { select: { nome: true } },
              department: { select: { name: true } },
              costCenter: { select: { description: true, externalCode: true, code: true } },
              approver: { select: { id: true, fullName: true } },
              assumidaPor: { select: { id: true, fullName: true } },
              solicitante: { select: { id: true, fullName: true } },
            },
          }),
          prisma.solicitation.count({ where }),
        ])
        logTiming('prisma.solicitation.list (/api/solicitacoes)', listStartedAt)

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

  setorDestino:
    formatCostCenterLabel(s.costCenter, '') || (s.department?.name ?? null),

  requiresApproval: s.requiresApproval,
  approvalStatus: s.approvalStatus,
}))
        return NextResponse.json({ rows, total })
      } catch (e) {
        console.error('GET /api/solicitacoes error', e)
        return NextResponse.json(
          { error: 'Erro ao listar solicitações.' },
          { status: 500 },
        )
      }
      })
  },
)

/**
 * Acha um "aprovador nível 3" vinculado ao centro de custo,
 * ou qualquer usuário como fallback.
 */
async function findLevel3ApproverForCostCenter(costCenterId?: string | null) {
  if (costCenterId) {
    const link = await prisma.userCostCenter.findFirst({
      where: { costCenterId },
      include: { user: true },
    })

    if (link?.user) {
      return link.user
    }
  }

  // fallback: qualquer usuário
  const fallback = await prisma.user.findFirst()
  return fallback
}

/**
 * Monta o payload padrão com dados do solicitante + campos do formulário
 */
async function buildPayload(
  solicitanteId: string,
  campos: Record<string, any>,
) {
  const user = await prisma.user.findUnique({
    where: { id: solicitanteId },
    include: { costCenter: true },
  })

  return {
    solicitante: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      login: user?.login ?? '',
      phone: user?.phone ?? '',
      costCenterText: user?.costCenter
        ? formatCostCenterLabel(user.costCenter, '')
        : '',
    },
    campos,
  }
}

/**
 * POST /api/solicitacoes
 */
export const POST = withModuleLevel(
  'solicitacoes',
  ModuleLevel.NIVEL_1,
  async (req: NextRequest, ctx) => {
    return withRequestMetrics('POST /api/solicitacoes', async () => {
      try {
        const { me } = ctx
        const body = await req.json().catch(() => null)

        if (!body || typeof body !== 'object') {
          return NextResponse.json(
            { error: 'Payload inválido para criação de solicitação.' },
            { status: 400 },
          )
        }

        const tipoId = body.tipoId as string | undefined
        const costCenterId = body.costCenterId as string | null | undefined
        const departmentId = body.departmentId as string | undefined
        const solicitanteId = me.id
        const campos = (body.campos ?? {}) as Record<string, any>

        if (!tipoId || !departmentId) {
          return NextResponse.json(
            {
              error: 'Tipo e departamento são obrigatórios.',
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
        const tipoMeta = (tipo.schemaJson as {
          meta?: { defaultPrioridade?: SolicitationPriority; defaultSlaHours?: number }
        } | null)?.meta
        const prioridade = tipoMeta?.defaultPrioridade
        const dataPrevista =
          typeof tipoMeta?.defaultSlaHours === 'number' &&
          Number.isFinite(tipoMeta.defaultSlaHours)
            ? new Date(Date.now() + tipoMeta.defaultSlaHours * 60 * 60 * 1000)
            : undefined
        const resolvedCostCenterId = costCenterId ?? me.costCenterId ?? null

        if (!resolvedCostCenterId) {
          return NextResponse.json(
            { error: 'Centro de custo é obrigatório.' },
            { status: 400 },
          )
        }


        // monta o payload com dados do solicitante + campos do formulário
        const payload: any = await buildPayload(solicitanteId, campos)

        // 1) cria a solicitação básica
        const created = await prisma.solicitation.create({
          data: {
            protocolo,
            tipoId,
            costCenterId: resolvedCostCenterId,
            departmentId,
            solicitanteId,
            titulo,
            descricao,
            prioridade,
            dataPrevista,
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

        const isSolicitacaoPessoal =
          tipo.nome === 'RQ_063 - Solicitação de Pessoal'
        const isSolicitacaoIncentivo =
          tipo.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
        const isDesligamento = isSolicitacaoDesligamento(tipo)
        const isNadaConsta = isSolicitacaoNadaConsta(tipo)
        const isAbonoEducacional =
          tipo.nome === 'Solicitação de Abono Educacional'

        const rhCostCenter = await prisma.costCenter.findFirst({
          where: {
            OR: [
              {
                description: {
                  contains: 'Recursos Humanos',
                  mode: 'insensitive',
                },
              },
              {
                abbreviation: {
                  contains: 'RH',
                  mode: 'insensitive',
                },
              },
              {
                code: { contains: 'RH', mode: 'insensitive' },
              },
            ],
          },
        })

         /* =====================================================================
           3) RQ_063 - Solicitação de Pessoal
           ===================================================================== */
        if (isSolicitacaoPessoal) {
          const rawCampo =
            (payload?.campos?.vagaPrevistaContrato as string | undefined) ??
            (payload?.campos?.vagaPrevista as string | undefined) ??
            ''

          const normalized = rawCampo
            ? rawCampo
                .toString()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toUpperCase()
            : ''

          const isSim = normalized === 'SIM' || normalized === 'S'

          if (isSim) {
            if (!rhCostCenter) {
              return NextResponse.json(
                {
                  error:
                    'Centro de custo de Recursos Humanos não encontrado para encaminhar a vaga prevista.',
                },
                { status: 400 },
              )
            }

            // vaga já prevista em contrato -> aprovação automática e direcionamento ao RH
            const updated = await prisma.solicitation.update({
              where: { id: created.id },
              data: {
                requiresApproval: false,
                approvalStatus: 'APROVADO',
                approvalAt: new Date(),
                approverId: null,
                status: 'ABERTA',
                costCenterId: rhCostCenter.id,
                departmentId: rhCostCenter.departmentId ?? departmentId,
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

            await prisma.solicitationTimeline.create({
              data: {
                solicitationId: created.id,
                status: 'AGUARDANDO_ATENDIMENTO',
                message:
                  'Solicitação aprovada automaticamente e encaminhada para o RH preencher os dados do candidato.',
              },
            })

            return NextResponse.json(updated, { status: 201 })
          }

          // qualquer coisa diferente de SIM exige aprovação
          const approver = await findLevel3ApproverForCostCenter(
            resolvedCostCenterId,
          )
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

      /* =====================================================================
           4) RQ_091 - Solicitação de Incentivo à Educação
           ===================================================================== */
        if (isSolicitacaoIncentivo) {
          if (!rhCostCenter) {
            return NextResponse.json(
              {
                error:
                  'Centro de custo de Recursos Humanos não encontrado para receber a solicitação.',
              },
              { status: 400 },
            )
          }

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              requiresApproval: true,
              approvalStatus: 'PENDENTE',
              approverId: null, // RH vai tratar
              status: 'AGUARDANDO_APROVACAO',
              costCenterId: rhCostCenter.id,
              departmentId: rhCostCenter.departmentId ?? departmentId,
            },
          })

          await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'AGUARDANDO_APROVACAO_GESTOR',
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_APROVACAO',
              message:
                'Solicitação enviada diretamente ao RH para aprovação e tratamento.',
            },
          })

       return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
          4.1) RQ_247 - Solicitação de Desligamento de Pessoal
           ===================================================================== */
        if (isDesligamento) {
          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              requiresApproval: false,
              approvalStatus: 'APROVADO',
              approvalAt: new Date(),
              approverId: null,
              status: 'ABERTA',
            },
          })

          await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'APROVACAO_AUTOMATICA',
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message:
                'Solicitação aprovada automaticamente e enviada ao centro de custo responsável.',
            },
          })
          return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
           4.2) RQ_300 - Nada Consta (encaminha para múltiplos setores)
           ===================================================================== */
        if (isNadaConsta) {
          const departamentosAlvo = await prisma.department.findMany({
            where: {
              OR: [
                { name: { contains: 'Tecnologia', mode: 'insensitive' } },
                { name: { contains: 'Informação', mode: 'insensitive' } },
                { name: { contains: 'TI', mode: 'insensitive' } },
                { name: { contains: 'Almoxarifado', mode: 'insensitive' } },
                { name: { contains: 'Logística', mode: 'insensitive' } },
                { name: { contains: 'Logistica', mode: 'insensitive' } },
                { name: { contains: 'SST', mode: 'insensitive' } },
                { name: { contains: 'Financeiro', mode: 'insensitive' } },
                { name: { contains: 'Fiscal', mode: 'insensitive' } },
              ],
            },
          })

          const departamentosFilhos = departamentosAlvo.filter(
            (dept) => dept.id !== departmentId,
          )

          if (departamentosFilhos.length > 0) {
            await prisma.$transaction(
              departamentosFilhos.map((dept) =>
                prisma.solicitation.create({
                  data: {
                    protocolo: generateProtocolo(),
                    tipoId,
                    costCenterId: resolvedCostCenterId,
                    departmentId: dept.id,
                    solicitanteId,
                    titulo,
                    descricao,
                    prioridade,
                    dataPrevista,
                    payload,
                    parentId: created.id,
                  },
                }),
              ),
            )
          }

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message:
                'Solicitação criada e encaminhada automaticamente para os setores responsáveis.',
            },
          })

          return NextResponse.json(created, { status: 201 })
        }



         /* =====================================================================
           5) Solicitação de Abono Educacional
           ===================================================================== */
        if (isAbonoEducacional) {
          const approver = await findLevel3ApproverForCostCenter(
            resolvedCostCenterId,
          )
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

        // ======================================================================
        // 6) Demais tipos: segue fluxo simples, sem aprovação especial
        // ======================================================================
        return NextResponse.json(created, { status: 201 })
      } catch (e) {
        console.error('POST /api/solicitacoes error', e)
        return NextResponse.json(
          { error: 'Erro ao criar solicitação.' },
          { status: 500 },
        )
      }
    })
  },
)