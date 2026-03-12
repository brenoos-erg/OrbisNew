export const revalidate = 0

// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, Prisma, SolicitationPriority } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { withModuleLevel } from '@/lib/access'
import { performance } from 'node:perf_hooks'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
     isSolicitacaoAgendamentoFerias,
  isSolicitacaoDesligamento,
  isSolicitacaoEquipamento,
  isSolicitacaoEpiUniforme,
  isSolicitacaoExamesSst,
  isSolicitacaoNadaConsta,
  isSolicitacaoPessoal,
  isSolicitacaoVeiculos,
   NADA_CONSTA_SETORES,
  resolveNadaConstaSetoresByDepartment,
} from '@/lib/solicitationTypes'
import { resolveResponsibleDepartmentsByTipo } from '@/lib/solicitationRouting'
import { buildNadaConstaReceivedFilters } from '@/lib/nadaConstaAccess'
import { buildSensitiveHiringVisibilityWhere, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'
import { notifyWorkflowStepEntry } from '@/lib/solicitationWorkflowNotifications'
import { nextSolicitationProtocolo } from '@/lib/protocolo'
import { resolveTipoApproverId } from '@/lib/solicitationTipoApprovers'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  listExperienceEvaluators,
} from '@/lib/experienceEvaluation'

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
    }
  }

  if (solicitante) {
    where.solicitante = {
      OR: [
        {
          fullName: { contains: solicitante },
        },
        {
          email: { contains: solicitante },
        },
      ],
    }
  }

  if (text) {
    const or: any[] = [
      {
        titulo: { contains: text },
      },
      {
        descricao: { contains: text },
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
              department: { select: { code: true, name: true } },
            },
          })

          for (const link of departmentLinks) {
            deptIds.add(link.departmentId)
          }

          if (deptIds.size > 0) {
            const departmentCostCenters = await prisma.costCenter.findMany({
              where: {
                departmentId: {
                  in: [...deptIds],
                },
              },
              select: { id: true },
            })

            for (const cc of departmentCostCenters) {
              ccIds.add(cc.id)
            }
          }

          const setorKeys = new Set<string>()
          const primarySetores = resolveNadaConstaSetoresByDepartment(
            me.department,
          )
          for (const setor of primarySetores) {
            setorKeys.add(setor)
          }

          for (const link of departmentLinks) {
            const resolved = resolveNadaConstaSetoresByDepartment(
              link.department,
            )
            for (const setor of resolved) {
              setorKeys.add(setor)
            }
          }

          const nadaConstaTypeFilters = buildNadaConstaReceivedFilters(setorKeys)
          const setorFilters =
            setorKeys.size > 0
              ? [
                  {
                    AND: [
                      { OR: nadaConstaTypeFilters },
                      {
                        solicitacaoSetores: {
                          some: { setor: { in: [...setorKeys] } },
                        },
                      },
                    ],
                  },
                ]
              : []

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
          const gestorAvaliadorFilter = {
            approverId: me.id,
            status: EXPERIENCE_EVALUATION_STATUS,
          }

          if (where.costCenterId) {
            const receivedFilters = ccIds.has(where.costCenterId)
              ? [{ costCenterId: where.costCenterId }]
              : []

            if (receivedFilters.length === 0 && setorFilters.length === 0) {
              where.AND = [
                ...(where.AND ?? []),
                { OR: [gestorAvaliadorFilter] },
              ]
            } else {
              where.AND = [
                ...(where.AND ?? []),
                { OR: [...receivedFilters, ...setorFilters, gestorAvaliadorFilter] },
              ]
            }
          } else {
            const receivedFilters = [
              ...(ccIds.size > 0 ? [{ costCenterId: { in: [...ccIds] } }] : []),
              ...(deptIds.size > 0
                ? [{ departmentId: { in: [...deptIds] } }]
                : []),
              ...dpFilters,
            ]

            if (receivedFilters.length === 0 && setorFilters.length === 0) {
             where.AND = [
                ...(where.AND ?? []),
                { OR: [gestorAvaliadorFilter] },
              ]
            } else {
              where.AND = [
                ...(where.AND ?? []),
                { OR: [...receivedFilters, ...setorFilters, gestorAvaliadorFilter] },
              ]
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
          where.OR = [
            { approverId: me.id },
            { tipo: { approvers: { some: { userId: me.id, role: 'APPROVER' } } } },
          ]
        }

        const userDepartmentIdsForSensitive = await getUserDepartmentIds(me.id, me.departmentId)

        where.AND = [
          ...(where.AND ?? []),
          buildSensitiveHiringVisibilityWhere({
            userId: me.id,
            role: me.role,
            departmentIds: userDepartmentIdsForSensitive,
          }),
        ]

     const listStartedAt = performance.now()
        const [solicitations, total] = await Promise.all([
          prisma.solicitation.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { dataAbertura: 'desc' },
            include: {
             tipo: { select: { codigo: true, nome: true } },
              department: { select: { name: true } },
              costCenter: { select: { description: true, externalCode: true, code: true } },
              approver: { select: { id: true, fullName: true } },
              assumidaPor: { select: { id: true, fullName: true } },
              solicitante: { select: { id: true, fullName: true } },
              eventos: {
                where: {
                  tipo: {
                    in: ['FINALIZADA', 'FINALIZADA_RH', 'FINALIZADA_DP', 'FINALIZADA_TI'],
                  },
                },
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { actor: { select: { id: true, fullName: true } } },
              },
           },
          }),
          prisma.solicitation.count({ where }),
        ])
        logTiming('prisma.solicitation.list (/api/solicitacoes)', listStartedAt)

        const rows = solicitations.map((s) => {
  const finalizadorEvent = s.eventos?.[0] ?? null

  return {
  id: s.id,
  titulo: s.titulo,
  status: s.status,
  protocolo: s.protocolo,
  createdAt: s.dataAbertura.toISOString(),
  tipo: s.tipo ? { codigo: s.tipo.codigo, nome: s.tipo.nome } : null,

  responsavelId: s.assumidaPor?.id ?? null,
  responsavel: s.assumidaPor ? { fullName: s.assumidaPor.fullName } : null,
  finalizadorId: finalizadorEvent?.actor?.id ?? null,
  finalizador: finalizadorEvent?.actor
    ? { fullName: finalizadorEvent.actor.fullName }
    : null,

  autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,

  sla: null,

  setorDestino: s.department?.name ?? formatCostCenterLabel(s.costCenter, ''),
  departamentoResponsavel: s.department?.name ?? null,
  departmentId: s.departmentId,
  approverId: s.approver?.id ?? s.approverId ?? null,

  requiresApproval: s.requiresApproval,
  approvalStatus: s.approvalStatus,
}
})
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

/**
 * Monta o payload padrão com dados do solicitante + campos do formulário
 */
async function buildPayload(
  solicitanteId: string,
  campos: Record<string, any>,
  options?: {
    solicitarParaOutroColaborador?: boolean
    solicitanteManual?: {
      fullName?: string
      email?: string
      login?: string
      phone?: string
      positionName?: string
      departmentName?: string
      leaderName?: string
      costCenterId?: string
      costCenterText?: string
    } | null
  },
) {
  const solicitarParaOutroColaborador = options?.solicitarParaOutroColaborador === true
  const solicitanteManual = options?.solicitanteManual ?? null

  const user = await prisma.user.findUnique({
    where: { id: solicitanteId },
    include: {
      costCenter: true,
      position: true,
      department: true,
      leader: true,
    },
  })
  let manualCostCenterText = ''
  if (solicitanteManual?.costCenterId) {
    const manualCostCenter = await prisma.costCenter.findUnique({
      where: { id: solicitanteManual.costCenterId },
    })

    if (manualCostCenter) {
      manualCostCenterText = formatCostCenterLabel(manualCostCenter, '')
    }
  }

  const payloadSolicitante = solicitarParaOutroColaborador
    ? {
        fullName: solicitanteManual?.fullName ?? '',
        email: solicitanteManual?.email ?? '',
        login: solicitanteManual?.login ?? '',
        phone: solicitanteManual?.phone ?? '',
        positionName: solicitanteManual?.positionName ?? '',
        departmentName: solicitanteManual?.departmentName ?? '',
        leaderName: solicitanteManual?.leaderName ?? '',
        costCenterId: solicitanteManual?.costCenterId ?? '',
        costCenterText:
          manualCostCenterText || solicitanteManual?.costCenterText || '',
      }
    : {
        fullName: user?.fullName ?? '',
        email: user?.email ?? '',
        login: user?.login ?? '',
        phone: user?.phone ?? '',
        positionName: user?.position?.name ?? '',
        departmentName: user?.department?.name ?? '',
        leaderName: user?.leader?.fullName ?? '',
        costCenterId: user?.costCenterId ?? '',
        costCenterText: user?.costCenter
          ? formatCostCenterLabel(user.costCenter, '')
          : '',
      }

  return {
    solicitarParaOutroColaborador,
    solicitanteManual: solicitarParaOutroColaborador ? payloadSolicitante : null,
    solicitante: payloadSolicitante,
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
      let idempotencyKey: string | null = null
      let requestId: string | null = null
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
        const idempotencyKeyRaw = body.idempotencyKey
        idempotencyKey =
          typeof idempotencyKeyRaw === 'string' && idempotencyKeyRaw.trim().length > 0
            ? idempotencyKeyRaw.trim()
            : null
        requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
         const solicitanteId = me.id
        const campos = (body.campos ?? {}) as Record<string, any>
        const solicitarParaOutroColaborador = body.solicitarParaOutroColaborador === true
        const solicitanteManual =
          body.solicitanteManual && typeof body.solicitanteManual === 'object'
            ? (body.solicitanteManual as Record<string, unknown>)
            : null

        console.info('POST /api/solicitacoes request', {
          requestId,
          idempotencyKey,
          solicitanteId,
          tipoId,
        })

        if (idempotencyKey) {
          const existingByIdempotency = await prisma.solicitation.findUnique({
            where: { idempotencyKey },
          })

          if (existingByIdempotency) {
            console.info('POST /api/solicitacoes duplicate prevented (pre-check)', {
              requestId,
              idempotencyKey,
              solicitationId: existingByIdempotency.id,
            })
            return NextResponse.json(existingByIdempotency, { status: 200 })
          }
        }

        if (!tipoId) {
          return NextResponse.json(
            {
              error: 'Tipo é obrigatório.',
            },
            { status: 400 },
          )
        }
         if (solicitarParaOutroColaborador) {
          const fullName = String(solicitanteManual?.fullName ?? '').trim()
          const email = String(solicitanteManual?.email ?? '').trim()
          const login = String(solicitanteManual?.login ?? '').trim()
          const costCenterIdManual = String(solicitanteManual?.costCenterId ?? '').trim()

           if (!fullName || !email || !costCenterIdManual) {
            return NextResponse.json(
              {
                error:
                  'Ao solicitar para outro colaborador, informe nome, e-mail e centro de custo.',
              },
              { status: 400 },
            )
          }
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

          
          const protocolo = await nextSolicitationProtocolo()
        const titulo = tipo.nome
        const tipoMeta = (tipo.schemaJson as {
          meta?: {
            defaultPrioridade?: SolicitationPriority
            defaultSlaHours?: number
            defaultDescricaoSolicitacao?: string
            prazoPadraoDias?: number
            departamentos?: string[]
          }
        } | null)?.meta
        const descricao = tipoMeta?.defaultDescricaoSolicitacao ?? null
        const prioridade = tipoMeta?.defaultPrioridade
        const dataPrevista =
          typeof tipoMeta?.prazoPadraoDias === 'number' &&
          Number.isFinite(tipoMeta.prazoPadraoDias)
            ? new Date(Date.now() + tipoMeta.prazoPadraoDias * 24 * 60 * 60 * 1000)
            : typeof tipoMeta?.defaultSlaHours === 'number' &&
                Number.isFinite(tipoMeta.defaultSlaHours)
              ? new Date(Date.now() + tipoMeta.defaultSlaHours * 60 * 60 * 1000)
              : undefined
        const routing = await resolveResponsibleDepartmentsByTipo(tipoId)
        const metaDepartmentId = Array.isArray(tipoMeta?.departamentos)
          ? tipoMeta.departamentos[0]
          : null
        const resolvedDepartmentId =
          metaDepartmentId ?? routing.mainDepartmentId ?? departmentId ?? me.departmentId ?? null
        if (!resolvedDepartmentId) {
          return NextResponse.json(
            {
              error:
                'Não foi possível identificar o departamento responsável. Configure meta.departamentos no tipo de solicitação.',
            },
            { status: 400 },
          )
        }
        const resolvedCostCenterId = costCenterId || me.costCenterId || null



        // monta o payload com dados do solicitante + campos do formulário
         if (isSolicitacaoDesligamento(tipo)) {
          campos.gestorSolicitanteInfo = `${me.fullName ?? me.login} / Cargo: gestor solicitante / Data: ${new Date().toISOString().slice(0, 10)}`
        }
        const payload: any = await buildPayload(solicitanteId, campos, {
          solicitarParaOutroColaborador,
          solicitanteManual: solicitanteManual
            ? {
                fullName: String(solicitanteManual.fullName ?? ''),
                email: String(solicitanteManual.email ?? ''),
                login: String(solicitanteManual.login ?? ''),
                phone: String(solicitanteManual.phone ?? ''),
                positionName: String(solicitanteManual.positionName ?? ''),
                departmentName: String(solicitanteManual.departmentName ?? ''),
                leaderName: String(solicitanteManual.leaderName ?? ''),
                costCenterId: String(solicitanteManual.costCenterId ?? ''),
                costCenterText: String(solicitanteManual.costCenterText ?? ''),
              }
            : null,
        })
         const isAvaliacaoExperiencia = tipoId === EXPERIENCE_EVALUATION_TIPO_ID

        if (isAvaliacaoExperiencia) {
          const gestorImediatoAvaliadorId =
            typeof campos.gestorImediatoAvaliadorId === 'string'
              ? campos.gestorImediatoAvaliadorId.trim()
              : ''

          if (!gestorImediatoAvaliadorId) {
            return NextResponse.json(
              { error: 'Selecione o gestor imediato avaliador.' },
              { status: 400 },
            )
          }

          const coordenadores = await listExperienceEvaluators()
          const gestorValido = coordenadores.some(
            (coordenador) => coordenador.id === gestorImediatoAvaliadorId,
          )

          if (!gestorValido) {
            return NextResponse.json(
              {
                error:
                  'Gestor imediato avaliador inválido. Verifique o grupo COORDENADORES_AVALIACAO_EXPERIENCIA.',
              },
              { status: 400 },
            )
          }

          payload.campos = {
            ...(payload.campos ?? {}),
            gestorImediatoAvaliadorId,
          }
        }

        // 1) cria a solicitação básica
        const created = await prisma.solicitation.create({
          data: {
            protocolo,
            tipoId,
             costCenterId: resolvedCostCenterId,
            departmentId: resolvedDepartmentId,
            solicitanteId,
            titulo,
            descricao,
            prioridade,
            dataPrevista,
            payload,
            idempotencyKey,
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
        await prisma.solicitationTimeline.create({
          data: {
            solicitationId: created.id,
            status: 'ABERTA',
            message: 'Solicitação criada pelo solicitante.',
          },
        })
        if (isAvaliacaoExperiencia) {
          const gestorImediatoAvaliadorId = String(
            payload?.campos?.gestorImediatoAvaliadorId ?? '',
          )

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              approverId: gestorImediatoAvaliadorId,
              status: EXPERIENCE_EVALUATION_STATUS as any,
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: EXPERIENCE_EVALUATION_STATUS as any,
              message: 'Encaminhada para gestor imediato avaliador.',
            },
          })

          await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'ENCAMINHADA_GESTOR_AVALIADOR',
            },
          })

          return NextResponse.json(updated, { status: 201 })
        }

        const isSolicitacaoPessoalTipo = isSolicitacaoPessoal(tipo)
        const isSolicitacaoIncentivo =
          tipo.nome === 'RQ_091 - Solicitação de Incentivo à Educação'
        const isDesligamento = isSolicitacaoDesligamento(tipo)
        const isNadaConsta = isSolicitacaoNadaConsta(tipo)
        const isAbonoEducacional =
          tipo.nome === 'Solicitação de Abono Educacional'
        const isAgendamentoFerias = isSolicitacaoAgendamentoFerias(tipo)
        const isSolicitacaoVeiculosTipo = isSolicitacaoVeiculos(tipo)
        const isSolicitacaoExames = isSolicitacaoExamesSst(tipo)
        const isSolicitacaoEquipamentoTi = isSolicitacaoEquipamento(tipo)
        const isSolicitacaoEpi = isSolicitacaoEpiUniforme(tipo)

        const rhCostCenter = await prisma.costCenter.findFirst({
          where: {
            OR: [
              {
                description: {
                  contains: 'Recursos Humanos',
                                  },
              },
              {
                abbreviation: {
                  contains: 'RH',
                },
              },
              {
                code: { contains: 'RH' },
              },
            ],
          },
        })

        const sstDepartment = await prisma.department.findUnique({
          where: { code: '19' },
          select: { id: true, name: true },
        })
        const logisticaDepartment = await prisma.department.findUnique({
          where: { code: '11' },
          select: { id: true, name: true },
        })

        if (isSolicitacaoExames) {

          if (!sstDepartment) {
            return NextResponse.json(
              { error: 'Departamento SEGURANÇA DO TRABALHO não encontrado.' },
              { status: 400 },
            )
          }

          const payloadAtualizado = {
            ...(payload as Record<string, any>),
            sst: {
              categoria: 'SERVIÇOS DE SST',
              solicitacaoCodigo: 'RQ.092',
              solicitacaoNome: 'SOLICITAÇÃO DE EXAMES',
              prazoLabel: '1 - DIA(S)',
              prazoDias: 1,
              empresa: 'ERG ENGENHARIA',
              dataAbertura: created.dataAbertura?.toISOString() ?? new Date().toISOString(),
              prazoSolucao:
                dataPrevista?.toISOString() ??
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          }

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              departmentId: sstDepartment.id,
              status: 'ABERTA',
              requiresApproval: false,
              approvalStatus: 'NAO_PRECISA',
              payload: payloadAtualizado,
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message:
                'Solicitação RQ.092 criada e encaminhada automaticamente para SEGURANÇA DO TRABALHO.',
            },
          })

          await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'ENCAMINHAMENTO_AUTOMATICO_SST',
            },
          })

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
            2.5) Agendamento de Férias (aguarda aprovação do gestor e segue para DP)
           ===================================================================== */
        if (isAgendamentoFerias) {
          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

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

           await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_APROVACAO',
              message: 'Solicitação de férias aguardando aprovação do gestor.',
            },
          })

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
           2.6) Solicitação de Equipamento (encaminha obrigatoriamente para TI)
           ===================================================================== */
        if (isSolicitacaoEquipamentoTi) {
           const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              departmentId: resolvedDepartmentId,
              costCenterId: resolvedCostCenterId,
              requiresApproval: false,
              approvalStatus: 'NAO_PRECISA',
              approverId,
              status: 'ABERTA',
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message: 'Solicitação de equipamento encaminhada automaticamente para TI.',
            },
          })

           await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'ENCAMINHADA_TI',
            },
          })

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
         /* =====================================================================
          3) RQ_063 - Solicitação de Pessoal
           ===================================================================== */
        if (isSolicitacaoPessoalTipo) {
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
                 departmentId: rhCostCenter.departmentId ?? resolvedDepartmentId,
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
                 status: 'ENCAMINHADA_RH',
                message:
                  'Solicitação de pessoal com vaga prevista em contrato encaminhada diretamente para o RH.',
              },
            })

           await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
          }

           // qualquer coisa diferente de SIM exige aprovação
          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

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

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_APROVACAO_SETOR',
              message:
                'Solicitação de pessoal aguardando aprovação do aprovador do setor para encaminhamento ao RH.',
            },
          })

     await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
        if (isSolicitacaoEpi) {
          if (!sstDepartment) {
            return NextResponse.json(
              { error: 'Departamento SEGURANÇA DO TRABALHO não encontrado.' },
              { status: 400 },
            )
          }
           const funcionarioStatusRaw = (payload as Record<string, any>)?.campos
            ?.funcionarioStatus
          const funcionarioStatus = funcionarioStatusRaw
            ? String(funcionarioStatusRaw).trim().toUpperCase()
            : ''
          const isFuncionarioAntigo = funcionarioStatus === 'ANTIGO'


           const payloadAtualizado = {
            ...(payload as Record<string, any>),
            epiUniforme: {
              categoria: 'SERVIÇOS DE LOGÍSTICA',
              solicitacaoCodigo: 'RQ.043',
              solicitacaoNome: 'REQUISIÇÃO DE EPI S/UNIFORMES',
              centroResponsavelLabel: sstDepartment.name,
              logisticaDepartmentId: logisticaDepartment?.id ?? null,
            },
          }

          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              departmentId: sstDepartment.id,
              payload: payloadAtualizado,
               requiresApproval: isFuncionarioAntigo,
              approvalStatus: isFuncionarioAntigo ? 'PENDENTE' : 'NAO_PRECISA',
              approverId,
              status: isFuncionarioAntigo ? 'AGUARDANDO_APROVACAO' : 'ABERTA',
            },
          })

          if (isFuncionarioAntigo) {
            await prisma.event.create({
              data: {
                id: crypto.randomUUID(),
                solicitationId: created.id,
                actorId: approverId,
                tipo: 'AGUARDANDO_APROVACAO_GESTOR',
              },
            })

            await prisma.solicitationTimeline.create({
              data: {
                solicitationId: created.id,
                status: 'AGUARDANDO_APROVACAO_SETOR',
                message:
                  'Solicitação de EPI/Uniformes para funcionário antigo encaminhada diretamente para aprovação do aprovador do setor.',
              },
            })
          } else {
            await prisma.event.create({
              data: {
                id: crypto.randomUUID(),
                solicitationId: created.id,
                actorId: solicitanteId,
                tipo: 'ENCAMINHAMENTO_AUTOMATICO_SST',
              },
            })

            await prisma.solicitationTimeline.create({
              data: {
                solicitationId: created.id,
                status: 'ENCAMINHADA_SST',
                message:
                  'Solicitação de EPI/Uniformes para funcionário novo criada e encaminhada à fila de atendimento do SST.',
              },
            })
          }

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }


          if (isSolicitacaoVeiculosTipo) {
          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

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

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_APROVACAO',
               message: 'Solicitação de veículos aguardando aprovação do gestor.',
            },
          })

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
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

          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              requiresApproval: true,
              approvalStatus: 'PENDENTE',
              approverId,
              status: 'AGUARDANDO_APROVACAO',
              costCenterId: rhCostCenter.id,
              departmentId: rhCostCenter.departmentId ?? resolvedDepartmentId,
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

        await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
          4.1) RQ_247 - Solicitação de Desligamento de Pessoal
           ===================================================================== */
        if (isDesligamento) {
          const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

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

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_APROVACAO',
              message: 'Solicitação de desligamento aguardando aprovação do gestor.',
            },
          })
          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
           4.2) RQ_300 - Nada Consta (encaminha para múltiplos setores)
           ===================================================================== */
        if (isNadaConsta || routing.multiSetor) {
          const setoresDestino = Array.from(
            new Set([
              ...NADA_CONSTA_SETORES.map((setor) => setor.key),
              ...routing.targetSetorKeys,
            ]),
          )

          await prisma.solicitacaoSetor.createMany({
            data: setoresDestino.map((setor) => ({
              solicitacaoId: created.id,
              setor,
              status: 'PENDENTE',
            })),
            skipDuplicates: true,
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message:
                'Solicitação criada e encaminhada automaticamente para os setores responsáveis.',
            },
          })

         await notifyWorkflowStepEntry({
            solicitationId: created.id,
            preferredDepartmentId: created.departmentId,
          })


        return NextResponse.json(created, { status: 201 })
        }



        
         /* =====================================================================
           5) Solicitação de Abono Educacional
           ===================================================================== */
        if (isAbonoEducacional) {
           const approverId = await resolveTipoApproverId(tipoId)
          if (!approverId) {
            return NextResponse.json({ error: 'Não existe aprovador configurado para este tipo de solicitação.' }, { status: 400 })
          }

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

          await notifyWorkflowStepEntry({
            solicitationId: updated.id,
            preferredKind: updated.status === 'AGUARDANDO_APROVACAO' ? 'APROVACAO' : undefined,
            preferredDepartmentId: updated.departmentId,
          })

          return NextResponse.json(updated, { status: 201 })
        }

        // ======================================================================
        // 6) Demais tipos: segue fluxo simples, sem aprovação especial
        // ======================================================================
         if (tipo.id === 'RQ_DP_049') {
          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message: 'Solicitação encaminhada para LOGÍSTICA.',
            },
          })

            await prisma.event.create({
            data: {
              id: crypto.randomUUID(),
              solicitationId: created.id,
              actorId: solicitanteId,
              tipo: 'ENCAMINHADA_LOGISTICA',
            },
          })
        }
        await notifyWorkflowStepEntry({
          solicitationId: created.id,
          preferredDepartmentId: created.departmentId,
        })

        return NextResponse.json(created, { status: 201 })
      } catch (e) {
         console.error('POST /api/solicitacoes error', { requestId, idempotencyKey, error: e })
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          if (idempotencyKey) {
            const existingByIdempotency = await prisma.solicitation.findUnique({
              where: { idempotencyKey },
            })

            if (existingByIdempotency) {
              console.info('POST /api/solicitacoes duplicate prevented (race)', {
                idempotencyKey,
                solicitationId: existingByIdempotency.id,
              })
              return NextResponse.json(existingByIdempotency, { status: 200 })
            }
          }
          return NextResponse.json({ error: 'Conflito de dados únicos ao criar solicitação.' }, { status: 409 })
        }
        return NextResponse.json(
          { error: 'Erro ao criar solicitação.' },
          { status: 500 },
        )
      }
    })
  },
)