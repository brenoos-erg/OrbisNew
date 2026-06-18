import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import {
  DEFAULT_TEMPLATE,
  createWorkflowRow,
  readWorkflowRows,
  updateWorkflowRow,
  type WorkflowDraft,
  type WorkflowStepKind,
} from '@/lib/solicitationWorkflowsStore'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

type ApiNodeKind = 'DEPARTMENT' | 'APPROVERS'

type ApiPayload = {
  typeId?: string
  nodes?: Array<{
    id: string
    label?: string
    kind?: ApiNodeKind | 'END'
    posX?: number
    posY?: number
    departmentId?: string | null
    notificationEmails?: string[]
    notificationTemplate?: { subject?: string; body?: string }
    approverUserIds?: string[]
    approverUserId?: string | null
    approvalTemplate?: { subject?: string; body?: string }
    notificationChannels?: {
      notifyRequester?: boolean
      notifyDepartment?: boolean
      notifyApprover?: boolean
      notifyAdmins?: boolean
    }
    notificationAdminEmails?: string[]
    enabled?: boolean
  }>
  edges?: Array<{ id?: string; source: string; target: string }>
}

const defaultNodes = [
  { id: 'SETOR_ORIGEM', label: 'Setor Origem', kind: 'DEPARTMENT' as const, posX: 50, posY: 80 },
  { id: 'APROVADORES', label: 'Aprovadores', kind: 'APPROVERS' as const, posX: 280, posY: 80 },
  { id: 'SETOR_DESTINO', label: 'Setor Destino', kind: 'DEPARTMENT' as const, posX: 520, posY: 80 },
 ]

const defaultEdges = [
  { id: 'e1', source: 'SETOR_ORIGEM', target: 'APROVADORES' },
  { id: 'e2', source: 'APROVADORES', target: 'SETOR_DESTINO' },
]

function toApiKind(kind: WorkflowStepKind): ApiNodeKind {
  if (kind === 'APROVACAO') return 'APPROVERS'
  return 'DEPARTMENT'
}

function toStoreKind(kind: ApiNodeKind | undefined): WorkflowStepKind {
  if (kind === 'APPROVERS') return 'APROVACAO'
  return 'DEPARTAMENTO'
}

function normalizeApiNodes(input: NonNullable<ApiPayload['nodes']>) {
  return input
    .map((node, index) => {
      const normalizedKind: ApiNodeKind = node.kind === 'APPROVERS' ? 'APPROVERS' : 'DEPARTMENT'
      const normalizedLabel =
        node.kind === 'END' && (node.label ?? '').trim().toLowerCase() === 'fim'
          ? 'Departamento final'
          : node.label ?? node.id
      return {
        id: node.id,
        label: normalizedLabel,
        kind: normalizedKind,
        posX: Number(node.posX ?? index * 240 + 40),
        posY: Number(node.posY ?? 80),
        departmentId: node.departmentId ?? null,
        notificationEmails: node.notificationEmails ?? [],
        notificationTemplate: {
          subject: node.notificationTemplate?.subject ?? DEFAULT_TEMPLATE.subject,
          body: node.notificationTemplate?.body ?? DEFAULT_TEMPLATE.body,
        },
        approverUserIds: node.approverUserIds ?? (node.approverUserId ? [node.approverUserId] : []),
        approvalTemplate: {
          subject: node.approvalTemplate?.subject ?? DEFAULT_TEMPLATE.subject,
          body: node.approvalTemplate?.body ?? DEFAULT_TEMPLATE.body,
        },
        notificationChannels: {
          notifyRequester: node.notificationChannels?.notifyRequester ?? false,
          notifyDepartment: node.notificationChannels?.notifyDepartment ?? true,
          notifyApprover: node.notificationChannels?.notifyApprover ?? normalizedKind === 'APPROVERS',
          notifyAdmins: node.notificationChannels?.notifyAdmins ?? false,
        },
        notificationAdminEmails: node.notificationAdminEmails ?? [],
        enabled: node.enabled ?? true,
      }
    })
    .filter((node) => Boolean(node.id))
}

function normalizeForPersistence(nodesInput: NonNullable<ApiPayload['nodes']>, edgesInput: NonNullable<ApiPayload['edges']>) {
  const nodes = normalizeApiNodes(nodesInput)
  const nodeIds = new Set(nodes.map((node) => node.id))

  const edges = edgesInput.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

  if (nodes.length === 0) {
    return normalizeForPersistence(defaultNodes, defaultEdges)
  }

  const lastNode = nodes[nodes.length - 1]
  if (lastNode?.kind === 'APPROVERS') {
    const finalStepIdBase = 'SETOR_DESTINO'
    let finalStepId = finalStepIdBase
    let suffix = 1
    while (nodeIds.has(finalStepId)) {
      finalStepId = `${finalStepIdBase}_${suffix}`
      suffix += 1
    }

   nodes.push({
      id: finalStepId,
      label: 'Setor Destino',
      kind: 'DEPARTMENT',
      posX: Number(lastNode.posX ?? 40) + 240,
      posY: Number(lastNode.posY ?? 80),
      departmentId: null,
      notificationEmails: [],
      notificationTemplate: { ...DEFAULT_TEMPLATE },
      approverUserIds: [],
      approvalTemplate: { ...DEFAULT_TEMPLATE },
      notificationChannels: {
        notifyRequester: false,
        notifyDepartment: true,
        notifyApprover: false,
        notifyAdmins: false,
      },
      notificationAdminEmails: [],
      enabled: true,
    })

    edges.push({ id: `auto-${finalStepId}`, source: lastNode.id, target: finalStepId })
  }

  const finalDepartmentId = [...nodes].reverse().find((node) => node.kind === 'DEPARTMENT')?.id

  const normalizedSteps = nodes.map((node, index) => ({
    order: index + 1,
    stepKey: node.id,
    label: node.label,
    kind: toStoreKind(node.kind),
    defaultDepartmentId: node.departmentId,
    notificationEmails: node.notificationEmails,
    notificationTemplate: node.notificationTemplate,
    approverUserIds: node.approverUserIds,
    approvalTemplate: node.approvalTemplate,
    canFinalize: node.id === finalDepartmentId,
    posX: node.posX,
    posY: node.posY,
    notificationChannels: node.notificationChannels,
    notificationAdminEmails: node.notificationAdminEmails,
    enabled: node.enabled,
  })) as WorkflowDraft['steps']
  return {
    steps: normalizedSteps,
    transitions: edges.map((edge) => ({
      fromStepKey: edge.source,
      toStepKey: edge.target,
    })),
  }
}
function rowToApi(row: WorkflowDraft, departmentNameById: Map<string, string>) {
  const orderedSteps = [...row.steps].sort((a, b) => a.order - b.order)
  const rawNodes = orderedSteps.map((step, index) => {
    const kind = toApiKind(step.kind)
    const fallbackLabel = step.kind === 'FIM' && step.label.trim().toLowerCase() === 'fim' ? 'Departamento final' : step.label
    const resolvedDepartmentName = step.defaultDepartmentId ? departmentNameById.get(step.defaultDepartmentId) : null
    const label = kind === 'DEPARTMENT' ? (resolvedDepartmentName ?? fallbackLabel) : fallbackLabel
    return {
      id: step.stepKey,
      label,
      kind,
      posX: Number((step as WorkflowDraft['steps'][number] & { posX?: number }).posX ?? index * 240 + 40),
      posY: Number((step as WorkflowDraft['steps'][number] & { posY?: number }).posY ?? 80),
      departmentId: step.defaultDepartmentId ?? null,
      notificationEmails: step.notificationEmails ?? [],
      notificationTemplate: step.notificationTemplate ?? DEFAULT_TEMPLATE,
      approverUserIds: step.approverUserIds ?? (step.approverUserId ? [step.approverUserId] : []),
      approvalTemplate: step.approvalTemplate ?? DEFAULT_TEMPLATE,
      notificationChannels: step.notificationChannels ?? {
        notifyRequester: false,
        notifyDepartment: true,
        notifyApprover: step.kind === 'APROVACAO',
        notifyAdmins: false,
      },
      notificationAdminEmails: step.notificationAdminEmails ?? [],
      enabled: step.enabled ?? true,
     }
  })
  const validIds = new Set(rawNodes.map((node) => node.id))
  return {
    workflowId: row.id,
    nodes: rawNodes,
    edges: row.transitions
      .filter((transition) => validIds.has(transition.fromStepKey) && validIds.has(transition.toStepKey))
      .map((transition, index) => ({
      id: `${row.id ?? 'wf'}-e-${index + 1}`,
      source: transition.fromStepKey,
      target: transition.toStepKey,
      })),
  }
}

async function enrichWorkflowRows(rows: WorkflowDraft[]) {
  const tipoIds = [...new Set(rows.map((row) => row.tipoId).filter(Boolean))]
  const departmentIds = [...new Set(rows.flatMap((row) => [row.departmentId, ...row.steps.map((step) => step.defaultDepartmentId)]).filter(Boolean) as string[])]
  const [tipos, departments] = await Promise.all([
    tipoIds.length
      ? prisma.tipoSolicitacao.findMany({ where: { id: { in: tipoIds } }, select: { id: true, nome: true, codigo: true } })
      : Promise.resolve([]),
    departmentIds.length
      ? prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ])
  const tipoMap = new Map(tipos.map((tipo) => [tipo.id, tipo]))
  const departmentMap = new Map(departments.map((department) => [department.id, department]))

  return rows.map((row) => ({
    ...row,
    tipo: tipoMap.get(row.tipoId) ?? null,
    department: row.departmentId ? departmentMap.get(row.departmentId) ?? null : null,
  }))
}

async function getAccess(action: Action) {
  const appUser = await requireActiveUser()
  const hasFeatureAccess = await canFeature(
    appUser.id,
    MODULE_KEYS.SOLICITACOES,
    FEATURE_KEYS.SOLICITACOES.FLUXOS,
    action,
  )

  return hasFeatureAccess
}


export async function GET(req: Request) {
  if (!(await getAccess('VIEW'))) {
    return NextResponse.json({ error: 'Sem permissão para visualizar o painel de e-mails.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId') ?? searchParams.get('tipoId')
  const departmentId = searchParams.get('departmentId')

  const rows = await readWorkflowRows()
  if (!typeId) {
    const filtered = departmentId
      ? rows.filter((row) => (row.departmentId ?? null) === departmentId)
      : rows
    return NextResponse.json(await enrichWorkflowRows(filtered))
  }

  const existing = rows.find((row) => row.tipoId === typeId && (!departmentId || (row.departmentId ?? null) === departmentId))

  if (existing) {
    const departmentIds = Array.from(new Set(existing.steps.map((step) => step.defaultDepartmentId).filter(Boolean))) as string[]
    const departments = departmentIds.length
      ? await prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, name: true } })
      : []
    const departmentNameById = new Map(departments.map((department) => [department.id, department.name]))
    return NextResponse.json(rowToApi(existing, departmentNameById))
  }

  return NextResponse.json({ workflowId: null, nodes: [], edges: [] })
}

export async function POST(req: Request) {
  const appUser = await requireActiveUser()
  if (!(await canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.FLUXOS, 'CREATE'))) {
    return NextResponse.json({ error: 'Sem permissão para criar workflow.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId') ?? searchParams.get('tipoId')
  const body = await req.json().catch(() => null)

  if (body && typeof body === 'object' && 'name' in body && 'tipoId' in body && Array.isArray((body as WorkflowDraft).steps)) {
    const draft = body as WorkflowDraft
    const created = await createWorkflowRow(draft, {
      actorId: appUser.id,
      action: 'CREATE',
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json(created, { status: 201 })
  }

  if (!typeId) return NextResponse.json({ error: 'typeId obrigatório' }, { status: 400 })
  const rows = await readWorkflowRows()
  const existing = rows.find((row) => row.tipoId === typeId)
  if (existing) return NextResponse.json({ error: 'Workflow já existe para este tipo.', workflowId: existing.id }, { status: 409 })
  const created = await createWorkflowRow({
    name: 'Fluxo padrão', tipoId: typeId, active: true,
    steps: defaultNodes.map((node, index) => ({ order: index + 1, stepKey: node.id, label: node.label, kind: toStoreKind(node.kind) })),
    transitions: defaultEdges.map((edge) => ({ fromStepKey: edge.source, toStepKey: edge.target })),
  }, { actorId: appUser.id, action: 'CREATE_DEFAULT', ip: req.headers.get('x-forwarded-for'), userAgent: req.headers.get('user-agent') })
  return NextResponse.json(rowToApi(created, new Map()), { status: 201 })
}

export async function PUT(req: Request) {
  const appUser = await requireActiveUser()
  if (!(await canFeature(appUser.id, MODULE_KEYS.SOLICITACOES, FEATURE_KEYS.SOLICITACOES.FLUXOS, 'UPDATE'))) {
    return NextResponse.json({ error: 'Sem permissão para editar o painel de e-mails.' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as ApiPayload | null
  const { typeId, nodes, edges } = body ?? {}


  if (!typeId) {
    return NextResponse.json({ error: 'typeId obrigatório' }, { status: 400 })
  }

  const rows = await readWorkflowRows()
  const existing = rows.find((row) => row.tipoId === typeId)

  const normalizedGraph = normalizeForPersistence(nodes ?? [], edges ?? [])

  const normalized: WorkflowDraft = {
    id: existing?.id,
    name: existing?.name ?? 'Fluxo de Solicitações',
    tipoId: typeId,
    departmentId: existing?.departmentId ?? null,
    active: true,
    steps: normalizedGraph.steps,
    transitions: normalizedGraph.transitions,
  }

  if (!existing) {
    await createWorkflowRow(normalized, { actorId: appUser.id, action: 'CREATE', ip: req.headers.get('x-forwarded-for'), userAgent: req.headers.get('user-agent') })
  } else {
    await updateWorkflowRow(existing.id!, normalized, { actorId: appUser.id, action: 'UPDATE', ip: req.headers.get('x-forwarded-for'), userAgent: req.headers.get('user-agent') })
  }

  return NextResponse.json({ ok: true })
}