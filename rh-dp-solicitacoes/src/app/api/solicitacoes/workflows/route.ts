import { NextResponse } from 'next/server'
import {
  DEFAULT_TEMPLATE,
  createWorkflowRow,
  readWorkflowRows,
  updateWorkflowRow,
  type WorkflowDraft,
  type WorkflowStepKind,
} from '@/lib/solicitationWorkflowsStore'

type ApiNodeKind = 'DEPARTMENT' | 'APPROVERS' | 'END'

type ApiPayload = {
  typeId?: string
  nodes?: Array<{
    id: string
    label?: string
    kind?: ApiNodeKind
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
  { id: 'FIM', label: 'Fim', kind: 'END' as const, posX: 760, posY: 80 },
]

const defaultEdges = [
  { id: 'e1', source: 'SETOR_ORIGEM', target: 'APROVADORES' },
  { id: 'e2', source: 'APROVADORES', target: 'SETOR_DESTINO' },
  { id: 'e3', source: 'SETOR_DESTINO', target: 'FIM' },
]

function toApiKind(kind: WorkflowStepKind): ApiNodeKind {
  if (kind === 'APROVACAO') return 'APPROVERS'
  if (kind === 'FIM') return 'END'
  return 'DEPARTMENT'
}

function toStoreKind(kind: ApiNodeKind | undefined): WorkflowStepKind {
  if (kind === 'APPROVERS') return 'APROVACAO'
  if (kind === 'END') return 'FIM'
  return 'DEPARTAMENTO'
}

function rowToApi(row: WorkflowDraft) {
  return {
    workflowId: row.id,
    nodes: row.steps.map((step, index) => ({
      id: step.stepKey,
      label: step.label,
      kind: toApiKind(step.kind),
     posX: Number((step as WorkflowDraft['steps'][number] & { posX?: number }).posX ?? index * 240 + 40),
      posY: Number((step as WorkflowDraft['steps'][number] & { posY?: number }).posY ?? 80),
      departmentId: step.defaultDepartmentId ?? null,
      notificationEmails: step.notificationEmails ?? [],
      notificationTemplate: step.notificationTemplate ?? DEFAULT_TEMPLATE,
      approverUserIds: step.approverUserIds ?? (step.approverUserId ? [step.approverUserId] : []),
      approvalTemplate: step.approvalTemplate ?? DEFAULT_TEMPLATE,
    })),
    edges: row.transitions.map((transition, index) => ({
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

  const normalized: WorkflowDraft = {
    id: existing?.id,
    name: existing?.name ?? 'Fluxo de Solicitações',
    tipoId: typeId,
    departmentId: existing?.departmentId ?? null,
    active: true,
    steps: (nodes ?? []).map((node, index) => ({
      order: index + 1,
      stepKey: node.id,
      label: node.label ?? node.id,
      kind: toStoreKind(node.kind),
      defaultDepartmentId: node.departmentId ?? null,
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
      posX: Number(node.posX ?? 0),
      posY: Number(node.posY ?? 0),
    })) as WorkflowDraft['steps'],
    transitions: (edges ?? []).map((edge) => ({
      fromStepKey: edge.source,
      toStepKey: edge.target,
    })),
  }

  if (!existing) {
    await createWorkflowRow(normalized)
  } else {
    await updateWorkflowRow(existing.id!, normalized)
  }

  return NextResponse.json({ ok: true })
}