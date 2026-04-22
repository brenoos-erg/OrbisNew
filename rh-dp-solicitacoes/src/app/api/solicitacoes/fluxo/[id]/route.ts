import { ApprovalStatus, ModuleLevel, SolicitationStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getUserModuleLevel, withModuleLevel } from '@/lib/access'
import {
  EXPERIENCE_EVALUATION_STATUS,
  EXPERIENCE_EVALUATION_TIPO_ID,
  listExperienceEvaluators,
  patchExperienceEvaluationEvaluatorPayload,
  patchExperienceEvaluationEvaluatorFields,
  resolveExperienceEvaluationEvaluatorFromDirectory,
} from '@/lib/experienceEvaluation'
import { resolvePrimaryResponsibleForList } from '@/lib/solicitationResponsibility'
import { isModuleLevelAtLeast } from '@/lib/moduleLevel'
import { prisma } from '@/lib/prisma'
import { readWorkflowRows } from '@/lib/solicitationWorkflowsStore'
import { notifyWorkflowStepEntry } from '@/lib/solicitationWorkflowNotifications'
import {
  getNadaConstaDefaultFieldsForSetor,
  isSolicitacaoNadaConsta,
  NADA_CONSTA_SETORES,
} from '@/lib/solicitationTypes'

const TIMELINE_DONE = new Set(['CONCLUIDA', 'ENCERRADA', 'APROVADA'])
const STATUS_LABEL: Record<SolicitationStatus, string> = {
  ABERTA: 'Aberta',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  AGUARDANDO_TERMO: 'Aguardando termo',
  AGUARDANDO_AVALIACAO_GESTOR: 'Aguardando avaliação do gestor',
  AGUARDANDO_FINALIZACAO_AVALIACAO: 'Aguardando finalização de avaliação',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const approvalStatusMap: Record<ApprovalStatus, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
  PENDENTE: 'PENDING',
  APROVADO: 'APPROVED',
  REPROVADO: 'REJECTED',
  NAO_PRECISA: 'PENDING',
}

function resolveStatusLabel(status: unknown) {
  return typeof status === 'string' && status in STATUS_LABEL
    ? STATUS_LABEL[status as SolicitationStatus]
    : String(status ?? '')
}

function resolveApprovalCardStatus(status: unknown): 'PENDING' | 'APPROVED' | 'REJECTED' {
  return typeof status === 'string' && status in approvalStatusMap
    ? approvalStatusMap[status as ApprovalStatus]
    : 'PENDING'
}
type UpdateBody =
  | { mode: 'EDIT_FIELDS'; titulo?: string; descricao?: string | null; campos?: Record<string, unknown>; reason?: string }
  | {
      mode: 'UPDATE_STATUS'
      status: SolicitationStatus
      departmentId?: string | null
      responsavelId?: string | null
      reason?: string
    }

type CampoEdicaoSchema = {
  name: string
  label?: string
  type?: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  section?: string
  stage?: string
  placeholder?: string
  readOnly?: boolean
  disabled?: boolean
  source?: string
}

function normalizeCampoType(campo: CampoEdicaoSchema): CampoEdicaoSchema {
  const name = typeof campo.name === 'string' ? campo.name.toLowerCase() : ''
  const looksLikeCostCenter =
    campo.type === 'cost_center' || name.includes('centrocusto') || name.includes('costcenter')

  return {
    ...campo,
    type: looksLikeCostCenter ? 'cost_center' : campo.type,
  }
}

function normalizeStringValue(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function resolveExperienceEvaluatorId(
  campos: Record<string, unknown>,
  evaluators: Array<{ id: string; fullName: string; login?: string | null; email?: string | null }>,
) {
  const resolved = resolveExperienceEvaluationEvaluatorFromDirectory({ campos }, evaluators)
  return normalizeStringValue(resolved?.id)
}

function stringifyComparable(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectId = normalizeStringValue((value as Record<string, unknown>).id)
    if (objectId) return objectId
  }
  return JSON.stringify(value)
}

function hasFieldValueChanged(before: unknown, after: unknown) {
  return stringifyComparable(before) !== stringifyComparable(after)
}

function resolveUserIdFromValue(value: unknown, users: Array<{ id: string; fullName: string }>) {
  const directId = normalizeStringValue(value)
  if (directId && users.some((user) => user.id === directId)) return directId

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const objectId = normalizeStringValue((value as Record<string, unknown>).id)
    if (objectId && users.some((user) => user.id === objectId)) return objectId
  }

  const byName = normalizeStringValue(value).toLocaleLowerCase('pt-BR')
  if (!byName) return null
  return users.find((user) => user.fullName.trim().toLocaleLowerCase('pt-BR') === byName)?.id ?? null
}

function resolveDepartmentIdFromValue(value: unknown, departments: Array<{ id: string; name: string }>) {
  const directId = normalizeStringValue(value)
  if (directId && departments.some((department) => department.id === directId)) return directId

  const byName = normalizeStringValue(value).toLocaleLowerCase('pt-BR')
  if (!byName) return null
  return departments.find((department) => department.name.trim().toLocaleLowerCase('pt-BR') === byName)?.id ?? null
}

function isFlowField(fieldName: string) {
  const normalized = fieldName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return [
    'responsavel',
    'avaliador',
    'aprovador',
    'gestorimediatoavaliador',
    'departamento',
    'setor',
    'fila',
    'etapa',
  ].some((token) => normalized.includes(token))
}

function normalizeConstaValue(value: unknown): 'CONSTA' | 'NADA_CONSTA' | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (normalized === 'CONSTA') return 'CONSTA'
  if (normalized === 'NADA CONSTA' || normalized === 'NADA_CONSTA') return 'NADA_CONSTA'
  return null
}

function normalizeSaudeStatusValue(value: unknown): 'CIENTE' | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  return normalized === 'CIENTE' ? 'CIENTE' : null
}

const ALWAYS_EDITABLE_FLOW_FIELDS = new Set([
  'gestorImediatoAvaliador',
  'gestorImediatoAvaliadorId',
  'gestorImediatoAvaliadorLogin',
  'gestorImediatoAvaliadorEmail',
  'avaliador',
  'avaliadorId',
  'avaliadorLogin',
  'avaliadorEmail',
  'gestor',
  'gestorId',
  'gestorLogin',
  'gestorEmail',
])



function summarizePayloadBlocks(payload: unknown) {
  if (!payload || typeof payload !== 'object') return []
  const root = payload as Record<string, unknown>
  const sections: Array<{ secao: string; campos: Array<{ chave: string; valor: unknown }> }> = []

  const addSection = (secao: string, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const entries = Object.entries(value as Record<string, unknown>).map(([chave, valor]) => ({ chave, valor }))
    if (entries.length > 0) sections.push({ secao, campos: entries })
  }

  addSection('Solicitante', root.solicitante)
  addSection('Campos do Formulário', root.campos)

  for (const [key, value] of Object.entries(root)) {
    if (key === 'solicitante' || key === 'campos') continue
    addSection(key, value)
  }

  return sections
}

export const GET = withModuleLevel('configuracoes', ModuleLevel.NIVEL_1, async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const term = decodeURIComponent(id).trim()
  const moduleLevel = await getUserModuleLevel(ctx.me.id, 'configuracoes')
  const canEdit = moduleLevel ? isModuleLevelAtLeast(moduleLevel, ModuleLevel.NIVEL_2) : false
  const canChangeStatus = moduleLevel ? isModuleLevelAtLeast(moduleLevel, ModuleLevel.NIVEL_3) : false

  const solicitation: any = await (prisma as any).solicitation.findFirst({
    where: {
      OR: [
        { id: term },
        { protocolo: term },
        { solicitante: { fullName: { contains: term } } },
        { payload: { path: '$.campos.matricula', string_contains: term } },
        { payload: { path: '$.solicitante.matricula', string_contains: term } },
        { tipo: { nome: { contains: term } } },
      ],
    },
    include: {
      tipo: { select: { id: true, nome: true, schemaJson: true } },
      solicitante: { select: { id: true, fullName: true, email: true, login: true } },
      department: { select: { id: true, name: true } },
      assumidaPor: { select: { id: true, fullName: true } },
      approver: { select: { id: true, fullName: true } },
      timelines: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!solicitation) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })

  const [departments, approverCandidates] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { status: 'ATIVO' }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' }, take: 200 }),
  ])

  const [costCenters, positions, experienceEvaluators] = await Promise.all([
    prisma.costCenter.findMany({ select: { id: true, code: true, description: true }, orderBy: [{ code: 'asc' }, { description: 'asc' }] }),
    prisma.position.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 500 }),
    listExperienceEvaluators(),
  ])

  const payloadCampos = ((solicitation.payload as Record<string, unknown>)?.campos ?? {}) as Record<string, unknown>
  const normalizedCampos = { ...payloadCampos }
  const resolvedEvaluatorId = resolveExperienceEvaluatorId(payloadCampos, experienceEvaluators)
  if (resolvedEvaluatorId) {
    const evaluator = experienceEvaluators.find((item) => item.id === resolvedEvaluatorId)
    normalizedCampos.gestorImediatoAvaliadorId = resolvedEvaluatorId
    if (evaluator) normalizedCampos.gestorImediatoAvaliador = evaluator.fullName
  }
  const schemaCampos = (((solicitation.tipo?.schemaJson as any)?.camposEspecificos ?? []) as CampoEdicaoSchema[])
    .filter((campo) => campo && typeof campo.name === 'string')
    .map(normalizeCampoType)
  const workflows = await readWorkflowRows()
  const workflow = workflows.find((row) => row.tipoId === solicitation.tipoId)
  const orderedSteps = workflow?.steps?.filter((step) => step.kind !== 'FIM') ?? []

  const inApproval = solicitation.approvalStatus === 'PENDENTE'
  const currentType = inApproval ? 'APPROVERS' : 'DEPARTMENT'
  const currentLabel = inApproval
    ? 'Aprovação'
    : orderedSteps.find((step) => step.kind === 'DEPARTAMENTO')?.label ?? solicitation.department?.name ?? 'Etapa atual'

  const approverIds = Array.from(
    new Set(orderedSteps.filter((step) => step.kind === 'APROVACAO').flatMap((step) => step.approverUserIds ?? [])),
  )

  const approvers = approverIds.length
    ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } })
    : solicitation.approver
      ? [{ id: solicitation.approver.id, fullName: solicitation.approver.fullName }]
      : []

  const aprovacoes = approvers.map((aprovador) => ({
    aprovador: aprovador.fullName,
    status: resolveApprovalCardStatus(solicitation.approvalStatus),
  }))

  const timelinePoints = solicitation.timelines ?? []
  const currentStepIndex = solicitation.status === 'CONCLUIDA' ? Number.MAX_SAFE_INTEGER : 0

  const historico = (orderedSteps.length
    ? orderedSteps
    : [{ order: 1, label: currentLabel, kind: inApproval ? 'APROVACAO' : ('DEPARTAMENTO' as const) }]
  ).map((step, index) => {
    const isDone = index < currentStepIndex
    const isCurrent = !isDone && index === currentStepIndex
    return {
      etapa: step.label,
      tipo: step.kind === 'APROVACAO' ? 'APPROVERS' : 'DEPARTMENT',
      status: isDone ? 'FINALIZADO' : isCurrent ? 'EM ANDAMENTO' : 'PENDENTE',
      dataInicio: timelinePoints[index]?.createdAt ?? null,
      dataFim: isDone ? timelinePoints[index + 1]?.createdAt ?? solicitation.dataFechamento : null,
    }
  })

   const currentTimelineStatus = timelinePoints.at(-1)?.status ?? solicitation.status
  const primaryResponsible = resolvePrimaryResponsibleForList({
    tipo: solicitation.tipo,
    assumidaPor: solicitation.assumidaPor,
    assumidaPorId: solicitation.assumidaPorId,
    approver: solicitation.approver,
    approverId: solicitation.approverId,
  })

  return NextResponse.json({
    solicitacao: {
      id: solicitation.id,
      protocolo: solicitation.protocolo,
      tipo: solicitation.tipo?.nome ?? '—',
      tipoId: solicitation.tipo?.id ?? '',
      solicitante: solicitation.solicitante?.fullName ?? '—',
      solicitanteId: solicitation.solicitante?.id ?? '',
      status: solicitation.status,
      statusLabel: resolveStatusLabel(solicitation.status),
      titulo: solicitation.titulo,
      descricao: solicitation.descricao,
      dataAbertura: solicitation.dataAbertura,
      dataPrevista: solicitation.dataPrevista,
      dataFechamento: solicitation.dataFechamento,
    },
    etapaAtual: {
      id: solicitation.id,
      nome: currentLabel,
      tipo: currentType,
      departamento: solicitation.department?.name ?? null,
      responsavelAtual: primaryResponsible.responsavel?.fullName ?? null,
      status: TIMELINE_DONE.has(currentTimelineStatus) ? 'FINALIZADO' : 'EM ANDAMENTO',
    },
    dadosChamado: { payload: solicitation.payload, secoes: summarizePayloadBlocks(solicitation.payload) },
    aprovacoes,
    historico,
    movimentacoes: timelinePoints.map((item: any) => ({ id: item.id, status: item.status, mensagem: item.message, data: item.createdAt })),
    permissions: { canEdit, canChangeStatus },
    statusOptions: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
   statusAtual: solicitation.status,
    departamentos: departments,
    responsaveis: approverCandidates,
    valoresEdicao: {
      titulo: solicitation.titulo,
      descricao: solicitation.descricao,
      campos: normalizedCampos,
    },
    formSchema: schemaCampos,
    dataSources: {
      costCenters,
      users: approverCandidates,
      experienceEvaluators,
      departments,
      positions,
    },
    metadata: {
      solicitanteEmail: solicitation.solicitante?.email ?? null,
      solicitanteLogin: solicitation.solicitante?.login ?? null,
      departamentoAtualId: solicitation.departmentId,
      responsavelAtualId: primaryResponsible.responsavelId,
    },
  })
})

export const PATCH = withModuleLevel('configuracoes', ModuleLevel.NIVEL_1, async (req: NextRequest, ctx) => {
  const moduleLevel = await getUserModuleLevel(ctx.me.id, 'configuracoes')
  const canEdit = moduleLevel ? isModuleLevelAtLeast(moduleLevel, ModuleLevel.NIVEL_2) : false
  const canChangeStatus = moduleLevel ? isModuleLevelAtLeast(moduleLevel, ModuleLevel.NIVEL_3) : false

  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as UpdateBody | null
  if (!body || typeof body !== 'object' || !('mode' in body)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const solicitation = await prisma.solicitation.findUnique({
    where: { id },
    include: {
      tipo: { select: { id: true, nome: true, codigo: true, schemaJson: true } },
    },
  })
  if (!solicitation) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })

  if (body.mode === 'EDIT_FIELDS') {
    if (!canEdit) return NextResponse.json({ error: 'Sem permissão para editar os dados do chamado.' }, { status: 403 })

     const currentPayload = (solicitation.payload as Record<string, unknown>) ?? {}
    const currentCampos = ((currentPayload.campos ?? {}) as Record<string, unknown>) ?? {}
    const incomingCampos = body.campos ?? {}

    const isExperienceEvaluation = solicitation.tipoId === EXPERIENCE_EVALUATION_TIPO_ID
    const sanitizedCampos = Object.fromEntries(
      Object.entries(incomingCampos).filter(
        ([key]) =>
          Object.prototype.hasOwnProperty.call(currentCampos, key) ||
          ALWAYS_EDITABLE_FLOW_FIELDS.has(key) ||
          (isExperienceEvaluation && key.startsWith('gestorImediatoAvaliador')),
      ),
    )

    const mergedCampos = { ...currentCampos, ...sanitizedCampos }
    const hasExperienceEvaluatorField =
      isExperienceEvaluation ||
      Object.prototype.hasOwnProperty.call(incomingCampos, 'gestorImediatoAvaliador') ||
      Object.prototype.hasOwnProperty.call(incomingCampos, 'gestorImediatoAvaliadorId') ||
      Object.prototype.hasOwnProperty.call(mergedCampos, 'gestorImediatoAvaliador') ||
      Object.prototype.hasOwnProperty.call(mergedCampos, 'gestorImediatoAvaliadorId')

    const [activeUsers, departments] = await Promise.all([
      prisma.user.findMany({
        where: { status: 'ATIVO' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
        take: 500,
      }),
      prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const flowChanges: string[] = []
    let resolvedApproverId: string | null | undefined = undefined
    let resolvedResponsibleId: string | null | undefined = undefined
    let resolvedDepartmentId: string | null | undefined = undefined
    let experienceEvaluatorChanged = false
    let experienceEvaluators: Array<{ id: string; fullName: string; login?: string | null; email?: string | null }> = []
    if (hasExperienceEvaluatorField) {
      experienceEvaluators = await listExperienceEvaluators()
      const previousEvaluatorId = resolveExperienceEvaluatorId(currentCampos, experienceEvaluators)
      const evaluatorId = resolveExperienceEvaluatorId(mergedCampos, experienceEvaluators)

      if (evaluatorId) {
        const evaluator = experienceEvaluators.find((item) => item.id === evaluatorId)
        Object.assign(
          mergedCampos,
          patchExperienceEvaluationEvaluatorFields(mergedCampos, evaluator ?? { id: evaluatorId }),
        )
      } else {
        const incomingEvaluatorId = normalizeStringValue(incomingCampos.gestorImediatoAvaliadorId)
        const incomingEvaluator = normalizeStringValue(incomingCampos.gestorImediatoAvaliador)
        if (incomingEvaluatorId === '' || incomingEvaluator === '') {
          Object.assign(mergedCampos, patchExperienceEvaluationEvaluatorFields(mergedCampos, null))
        }
      }

      if (previousEvaluatorId !== evaluatorId) {
        flowChanges.push(`avaliador alterado (${previousEvaluatorId || '—'} → ${evaluatorId || '—'})`)
        if ((solicitation.status as string) !== EXPERIENCE_EVALUATION_STATUS) {
          flowChanges.push(`etapa reaberta (${solicitation.status} → ${EXPERIENCE_EVALUATION_STATUS})`)
        }
        resolvedApproverId = evaluatorId || null
        resolvedResponsibleId = null
        experienceEvaluatorChanged = true
      }
    }

    for (const [fieldName, afterValue] of Object.entries(mergedCampos)) {
      if (!isFlowField(fieldName)) continue
      const beforeValue = currentCampos[fieldName]
      if (!hasFieldValueChanged(beforeValue, afterValue)) continue

      const normalizedField = fieldName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

      if ((normalizedField.includes('departamento') || normalizedField.includes('setor')) && normalizedField.includes('id')) {
        const targetDepartmentId = resolveDepartmentIdFromValue(afterValue, departments)
        if (targetDepartmentId && targetDepartmentId !== solicitation.departmentId) {
          resolvedDepartmentId = targetDepartmentId
          flowChanges.push(`departamento/setor alterado (${stringifyComparable(beforeValue) || '—'} → ${stringifyComparable(afterValue) || '—'})`)
        }
      }

      if (normalizedField.includes('aprovador') || normalizedField.includes('avaliador')) {
        if (experienceEvaluatorChanged) continue
        const targetApproverId = resolveUserIdFromValue(afterValue, activeUsers)
        if (targetApproverId && targetApproverId !== solicitation.approverId) {
          resolvedApproverId = targetApproverId
          flowChanges.push(`${fieldName} alterado (${stringifyComparable(beforeValue) || '—'} → ${stringifyComparable(afterValue) || '—'})`)
        }
      }

      if (normalizedField.includes('responsavel')) {
        if (experienceEvaluatorChanged) continue
        const targetResponsibleId = resolveUserIdFromValue(afterValue, activeUsers)
        if (targetResponsibleId && targetResponsibleId !== solicitation.assumidaPorId) {
          resolvedResponsibleId = targetResponsibleId
          flowChanges.push(`responsável alterado (${stringifyComparable(beforeValue) || '—'} → ${stringifyComparable(afterValue) || '—'})`)
        }
      }
    }

    if (isExperienceEvaluation && resolvedApproverId !== undefined) {
      resolvedResponsibleId = null
    }

    const updatedPayload = {
      ...currentPayload,
      campos: mergedCampos,
    }
    const canonicalExperiencePayload =
      hasExperienceEvaluatorField && isExperienceEvaluation
        ? patchExperienceEvaluationEvaluatorPayload(
            updatedPayload,
            resolveExperienceEvaluationEvaluatorFromDirectory(
              { campos: mergedCampos },
              experienceEvaluators,
            ) ?? null,
          )
        : updatedPayload

    const updated = await prisma.$transaction(async (tx) => {
      const shouldReopenExperienceEvaluatorStage =
        isExperienceEvaluation &&
        resolvedApproverId !== undefined &&
        solicitation.status !== EXPERIENCE_EVALUATION_STATUS

      const solicitationUpdated = await tx.solicitation.update({
        where: { id },
        data: {
          titulo: typeof body.titulo === 'string' ? body.titulo : solicitation.titulo,
          descricao: typeof body.descricao === 'string' || body.descricao === null ? body.descricao : solicitation.descricao,
          payload: canonicalExperiencePayload as any,
          ...(resolvedApproverId !== undefined ? { approverId: resolvedApproverId } : {}),
          ...(resolvedResponsibleId !== undefined ? { assumidaPorId: resolvedResponsibleId } : {}),
          ...(resolvedDepartmentId !== undefined ? { departmentId: resolvedDepartmentId } : {}),
          ...(shouldReopenExperienceEvaluatorStage
            ? {
                status: EXPERIENCE_EVALUATION_STATUS,
                dataFechamento: null,
                dataCancelamento: null,
              }
            : {}),
          // Regra de negócio: manter dataAbertura original e não resetar automaticamente prazos/SLA.
          // O recálculo de SLA deve ser tratado por rotina específica, se necessário.
        },
      })

      if (isSolicitacaoNadaConsta(solicitation.tipo as any)) {
        const schemaCampos = (((solicitation.tipo?.schemaJson as any)?.camposEspecificos ?? []) as CampoEdicaoSchema[])
          .filter((campo) => campo && typeof campo.name === 'string')

        for (const setorMeta of NADA_CONSTA_SETORES) {
          const schemaFieldNames = schemaCampos
            .filter((campo) => campo.stage === setorMeta.stage)
            .map((campo) => campo.name)
          const defaultFieldNames = getNadaConstaDefaultFieldsForSetor(setorMeta.key).map((field) => field.name)
          const setorFieldNames = new Set([setorMeta.constaField, ...defaultFieldNames, ...schemaFieldNames])
          const hasAnySetorUpdate = Array.from(setorFieldNames).some((fieldName) =>
            Object.prototype.hasOwnProperty.call(mergedCampos, fieldName),
          )
          if (!hasAnySetorUpdate) continue

          const setorCampos = Object.fromEntries(
            Array.from(setorFieldNames).map((fieldName) => [fieldName, String(mergedCampos[fieldName] ?? '')]),
          )

          const rawStatus = mergedCampos[setorMeta.constaField]
          const constaFlag =
            setorMeta.key === 'SAUDE' || setorMeta.key === 'SST'
              ? normalizeSaudeStatusValue(rawStatus)
                ? 'NADA_CONSTA'
                : null
              : normalizeConstaValue(rawStatus)

          await tx.solicitacaoSetor.upsert({
            where: {
              solicitacaoId_setor: {
                solicitacaoId: id,
                setor: setorMeta.key,
              },
            },
            create: {
              solicitacaoId: id,
              setor: setorMeta.key,
              campos: setorCampos,
              constaFlag,
              status: constaFlag ? 'CONCLUIDO' : 'PENDENTE',
            },
            update: {
              campos: setorCampos,
              constaFlag,
              status: constaFlag ? 'CONCLUIDO' : 'PENDENTE',
              finalizadoEm: constaFlag ? new Date() : null,
              finalizadoPor: constaFlag ? ctx.me.id : null,
            },
          })
        }
      }

      return solicitationUpdated
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: 'EM_ATENDIMENTO',
        message: [
          `Dados do chamado atualizados por ${ctx.me.fullName ?? ctx.me.id}.`,
          flowChanges.length > 0 ? `Fluxo reprocessado: ${flowChanges.join('; ')}.` : null,
          body.reason ? `Motivo: ${body.reason}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
      },
    })

    if (flowChanges.length > 0) {
      await notifyWorkflowStepEntry({
        solicitationId: id,
        preferredKind: resolvedApproverId !== undefined ? 'APROVACAO' : undefined,
        preferredDepartmentId: resolvedDepartmentId ?? undefined,
        forceReplay: true,
      })
    }
    return NextResponse.json({ ok: true, updatedId: updated.id })
  }

  if (body.mode === 'UPDATE_STATUS') {
    if (!canChangeStatus) return NextResponse.json({ error: 'Sem permissão para alterar status/tramitação.' }, { status: 403 })

    const nextStatus = body.status
    if (!nextStatus || !(nextStatus in STATUS_LABEL)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })

    const updated = await prisma.solicitation.update({
      where: { id },
      data: {
        status: nextStatus,
        departmentId: typeof body.departmentId === 'string' && body.departmentId ? body.departmentId : solicitation.departmentId,
        assumidaPorId:
          body.responsavelId === null
            ? null
            : typeof body.responsavelId === 'string' && body.responsavelId
              ? body.responsavelId
              : solicitation.assumidaPorId,
        dataFechamento: nextStatus === 'CONCLUIDA' ? new Date() : solicitation.dataFechamento,
        dataCancelamento: nextStatus === 'CANCELADA' ? new Date() : solicitation.dataCancelamento,
      },
    })

    await prisma.solicitationTimeline.create({
      data: {
        solicitationId: id,
        status: nextStatus,
        message: [
          `Status alterado manualmente por ${ctx.me.fullName ?? ctx.me.id}.`,
          `Anterior: ${solicitation.status}.`,
          `Novo: ${nextStatus}.`,
          body.reason ? `Motivo: ${body.reason}.` : null,
        ]
          .filter(Boolean)
          .join(' '),
      },
    })

    return NextResponse.json({ ok: true, updatedId: updated.id, from: solicitation.status, to: nextStatus })
  }

  return NextResponse.json({ error: 'Modo de atualização inválido.' }, { status: 400 })
})
