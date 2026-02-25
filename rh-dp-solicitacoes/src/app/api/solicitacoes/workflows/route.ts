import { NextResponse } from 'next/server'
import {
  DEFAULT_TEMPLATE,
  createWorkflowRow,
  readWorkflowRows,
  updateWorkflowRow,
  type WorkflowDraft,
  type WorkflowStepKind,
} from '@/lib/solicitationWorkflowsStore'

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
  })) as WorkflowDraft['steps']
  return {
    steps: normalizedSteps,
    transitions: edges.map((edge) => ({
      fromStepKey: edge.source,
      toStepKey: edge.target,
    })),
  }
}

function rowToApi(row: WorkflowDraft) {
  const orderedSteps = [...row.steps].sort((a, b) => a.order - b.order)
  const rawNodes = orderedSteps.map((step, index) => {
    const kind = toApiKind(step.kind)
    const label = step.kind === 'FIM' && step.label.trim().toLowerCase() === 'fim' ? 'Departamento final' : step.label
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId')
  if (!typeId) {
    return NextResponse.json({ error: 'typeId obrigatório' }, { status: 400 })
  }

  const rows = await readWorkflowRows()
  const existing = rows.find((row) => row.tipoId === typeId)

  if (existing) return NextResponse.json(rowToApi(existing))

  const created = await createWorkflowRow({
    name: 'Fluxo padrão',
    tipoId: typeId,
    active: true,
    steps: defaultNodes.map((node, index) => ({
      order: index + 1,
      stepKey: node.id,
      label: node.label,
      kind: toStoreKind(node.kind),
    })),
    transitions: defaultEdges.map((edge) => ({
      fromStepKey: edge.source,
      toStepKey: edge.target,
    })),
  })

  return NextResponse.json(rowToApi(created))
}

export async function PUT(req: Request) {
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
    await createWorkflowRow(normalized)
  } else {
    await updateWorkflowRow(existing.id!, normalized)
  }

  return NextResponse.json({ ok: true })
}