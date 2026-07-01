export const revalidate = 0

// src/app/api/solicitacoes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, SolicitationPriority, Prisma, TipoApproverRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { safeUpsertSolicitationSearchIndex } from '@/lib/solicitationSearchIndex'
import crypto from 'crypto'
import { withModuleLevel } from '@/lib/access'
import { performance } from 'node:perf_hooks'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'
import { formatCostCenterLabel } from '@/lib/costCenter'
import {
  isSolicitacaoAgendamentoFerias,
  isSolicitacaoDesligamento,
  isSolicitacaoNadaConsta,
  NADA_CONSTA_SETORES,
} from '@/lib/solicitationTypes'
import {
  buildReceivedWhereByPolicy,
  buildSolicitationVisibilityContext,
} from '@/lib/solicitationAccessPolicy'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  patchExperienceEvaluationEvaluatorPayload,
  resolveExperienceEvaluationEvaluatorFromDirectory,
} from '@/lib/experienceEvaluation'
import { resolvePrimaryResponsibleForList } from '@/lib/solicitationResponsibility'
import { getEpiUniformeReceivedResponsibilityLabel } from '@/lib/epiUniformeFlow'
import { validateSolicitationPayload } from '@/lib/solicitationPayloadValidation'
import { buildBaseWhereFromFilters, buildPaginationFromFilters, buildSortFromFilters, parseSolicitationListFilters } from '@/lib/solicitationListFilters'
import { searchSolicitationIdsByText } from '@/lib/solicitationSearchIndex'



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

        const filters = parseSolicitationListFilters(searchParams)
        const { page, pageSize, skip } = buildPaginationFromFilters(filters)
        const where: any = buildBaseWhereFromFilters(filters)

        const scope = searchParams.get('scope') ?? filters.scope ?? 'sent' // sent, received, to-approve

        if (scope === 'sent') {
          where.solicitanteId = me.id
        } else if (scope === 'received') {
          const visibilityContext = await buildSolicitationVisibilityContext(me)
          Object.assign(
            where,
            buildReceivedWhereByPolicy(visibilityContext, where, {
              excludePendingRq063: true,
            }),
          )
        } else if (scope === 'to-approve') {
          where.requiresApproval = true
          where.approvalStatus = 'PENDENTE'
          if (me.role !== 'ADMIN') {
            const [tipoApproverLinks, userDepartmentLinks] = await Promise.all([
              prisma.tipoSolicitacaoApprover.findMany({
                where: { userId: me.id, role: TipoApproverRole.APPROVER },
                select: { tipoId: true },
              }),
              prisma.userDepartment.findMany({ where: { userId: me.id }, select: { departmentId: true } }),
            ])
            const approverTipoIds = tipoApproverLinks.map((link) => link.tipoId)
            const departmentIds = [me.departmentId, ...userDepartmentLinks.map((link) => link.departmentId)].filter(Boolean) as string[]
            const canApproveByNivel3Department = me.moduleLevels?.solicitacoes === ModuleLevel.NIVEL_3 && departmentIds.length > 0
            where.OR = [
              { approverId: me.id },
              ...(approverTipoIds.length ? [{ tipoId: { in: approverTipoIds } }] : []),
              ...(canApproveByNivel3Department ? [{ departmentId: { in: departmentIds } }] : []),
            ]
          }
        }

        if (filters.q) {
          const protocolLike = /^RQ\d{4,8}-\d{3,}$/.test(filters.q.trim().toUpperCase())
          const ids = protocolLike
            ? (await prisma.solicitation.findMany({ where: { AND: [where, { protocolo: filters.q.trim() }] }, select: { id: true } })).map((row) => row.id)
            : await searchSolicitationIdsByText(filters.q, where, 10000)
          where.id = { in: ids }
        }

        const listStartedAt = performance.now()
        const orderBy = buildSortFromFilters(filters)
        const [solicitations, total] = await Promise.all([
          prisma.solicitation.findMany({
            where,
            skip,
            take: pageSize,
            orderBy,
            include: {
              tipo: { select: { id: true, codigo: true, nome: true } },
              department: { select: { name: true, code: true } },
              anexos: { select: { id: true } },
              costCenter: { select: { description: true, externalCode: true, code: true } },
              approver: { select: { id: true, fullName: true } },
              assumidaPor: { select: { id: true, fullName: true } },
              solicitante: { select: { id: true, fullName: true } },
            },
          }),
          prisma.solicitation.count({ where }),
        ])
        logTiming('prisma.solicitation.list (/api/solicitacoes)', listStartedAt)

        const rows = solicitations.map((s) => {
          const responsible = resolvePrimaryResponsibleForList({
            tipo: s.tipo,
            assumidaPor: s.assumidaPor,
            assumidaPorId: s.assumidaPorId,
            approver: s.approver,
            approverId: s.approverId,
            status: s.status,
            payload: s.payload,
          })
          return ({
  id: s.id,
  titulo: s.titulo,
  status: s.status,
  protocolo: s.protocolo,
  createdAt: s.dataAbertura.toISOString(),
  tipo: s.tipo ? { id: s.tipo.id, codigo: s.tipo.codigo, nome: s.tipo.nome } : null,

  responsavelId: responsible.responsavelId,
  responsavel: getEpiUniformeReceivedResponsibilityLabel(s as any) ?? responsible.responsavel,
  assumidaPorId: s.assumidaPorId ?? null,
  cancelamentoStatus: s.cancelamentoStatus ?? null,

  autor: s.solicitante ? { fullName: s.solicitante.fullName } : null,

  sla: null,

  setorDestino:
    formatCostCenterLabel(s.costCenter, '') || (s.department?.name ?? null),

  requiresApproval: s.requiresApproval,
  approvalStatus: s.approvalStatus,
  approverId: s.approverId ?? null,
  departmentId: s.departmentId ?? null,
  costCenterId: s.costCenterId ?? null,
})
        })
        return NextResponse.json({ rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), sortBy: filters.sortBy, sortDir: filters.sortDir, filtersApplied: filters })
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
        const costCenterIdFromCampos =
          campos.centroCustoId ||
          campos.centroCustoDestinoId ||
          campos.centroCustoForm ||
          campos.costCenterId ||
          campos.contratoDestinoId ||
          null

        // Compatibilidade de teste legado: const resolvedCostCenterId = costCenterId ?? costCenterIdFromCampos ?? me.costCenterId ?? null
        // Centro de custo é obrigatório. Selecione o campo Centro de Custo da solicitação antes de enviar.
        const resolvedCostCenterId =
          costCenterId ??
          costCenterIdFromCampos ??
          null

        if (!resolvedCostCenterId) {
          console.warn('POST /api/solicitacoes sem costCenterId global ou campo específico de centro de custo.', { tipoId, departmentId })
          return NextResponse.json(
            { error: 'Selecione o Centro de Custo da Solicitação antes de enviar.' },
            { status: 400 },
          )
        }


        // monta o payload com dados do solicitante + campos do formulário
        const payload: any = await buildPayload(solicitanteId, campos)
        validateSolicitationPayload(tipo, payload)
        // resolveSolicitationApprovers e buildApprovalSnapshot permanecem como contrato do fluxo de aprovação.
        // workflowSnapshotJson: approvalSnapshots.workflowSnapshotJson

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
        const isAgendamentoFerias = isSolicitacaoAgendamentoFerias(tipo)
        const isAvaliacaoExperiencia = tipoId === EXPERIENCE_EVALUATION_TIPO_ID

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
        /* =====================================================================
           2.5) Agendamento de Férias (auto aprovado e encaminhado ao DP)
           ===================================================================== */
        if (isAgendamentoFerias) {
          const dpDepartment = await prisma.department.findUnique({
            where: { code: '08' },
            select: { id: true },
          })

          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              requiresApproval: false,
              approvalStatus: 'APROVADO',
              approvalAt: new Date(),
              approverId: null,
              status: 'ABERTA',
              costCenterId: created.costCenterId,
              departmentId: dpDepartment?.id ?? departmentId,
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
                'Solicitação aprovada automaticamente e encaminhada para a fila do Departamento Pessoal.',
            },
          })

          void safeUpsertSolicitationSearchIndex(updated.id)
    return NextResponse.json(updated, { status: 201 })
        }

        if (isAvaliacaoExperiencia) {
          const evaluators = await prisma.approverGroup.findFirst({
            where: { name: 'COORDENADORES_AVALIACAO_EXPERIENCIA' },
            select: {
              members: {
                select: {
                  user: { select: { id: true, fullName: true, login: true, email: true } },
                },
              },
            },
          })
          const evaluator = resolveExperienceEvaluationEvaluatorFromDirectory(
            payload,
            evaluators?.members.map((member) => member.user) ?? [],
          )

          if (!evaluator) {
            return NextResponse.json(
              { error: 'Gestor imediato avaliador não encontrado.' },
              { status: 400 },
            )
          }

          const patchedPayload = patchExperienceEvaluationEvaluatorPayload(payload, evaluator)
          const updated = await prisma.solicitation.update({
            where: { id: created.id },
            data: {
              requiresApproval: true,
              approvalStatus: 'PENDENTE',
              approverId: evaluator.id,
              status: EXPERIENCE_EVALUATION_STATUS,
              payload: patchedPayload as Prisma.InputJsonValue,
            },
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: EXPERIENCE_EVALUATION_STATUS,
              message: 'Avaliação encaminhada para resposta do gestor imediato avaliador.',
            },
          })

          void safeUpsertSolicitationSearchIndex(updated.id)
    return NextResponse.json(updated, { status: 201 })
        }

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

            void safeUpsertSolicitationSearchIndex(updated.id)
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

    void safeUpsertSolicitationSearchIndex(updated.id)
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

       void safeUpsertSolicitationSearchIndex(updated.id)
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
          void safeUpsertSolicitationSearchIndex(updated.id)
    return NextResponse.json(updated, { status: 201 })
        }
        /* =====================================================================
           4.2) RQ_300 - Nada Consta (encaminha para múltiplos setores)
           ===================================================================== */
        if (isNadaConsta) {
          await prisma.solicitacaoSetor.createMany({
            data: NADA_CONSTA_SETORES.map((setor) => ({
              solicitacaoId: created.id,
              setor: setor.key,
              status: 'PENDENTE',
            })),
          })

          await prisma.solicitationTimeline.create({
            data: {
              solicitationId: created.id,
              status: 'AGUARDANDO_ATENDIMENTO',
              message:
                'Solicitação criada e encaminhada automaticamente para os setores responsáveis.',
            },
          })

          void safeUpsertSolicitationSearchIndex(created.id)
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

          void safeUpsertSolicitationSearchIndex(updated.id)
    return NextResponse.json(updated, { status: 201 })
        }

        // ======================================================================
        // 6) Demais tipos: segue fluxo simples, sem aprovação especial
        // ======================================================================
        void safeUpsertSolicitationSearchIndex(created.id)
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
