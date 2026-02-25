import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type WorkflowStepKind = 'DEPARTAMENTO' | 'APROVACAO' | 'FIM'

export type WorkflowTemplateDraft = {
  subject: string
  body: string
}

export type WorkflowStepDraft = {
  order: number
  stepKey: string
  label: string
  kind: WorkflowStepKind
  defaultDepartmentId?: string | null
  approverGroupId?: string | null
  approverUserId?: string | null
  approverUserIds?: string[]
  requiresApproval?: boolean
  canAssume?: boolean
  canFinalize?: boolean
  notificationEmails?: string[]
  notificationTemplate?: WorkflowTemplateDraft
  approvalTemplate?: WorkflowTemplateDraft
}

export type WorkflowTransitionDraft = {
  fromStepKey: string
  toStepKey: string
}

export type WorkflowDraft = {
  id?: string
  name: string
  tipoId: string
  departmentId?: string | null
  active: boolean
  steps: WorkflowStepDraft[]
  transitions: WorkflowTransitionDraft[]
}

const DB_FILE = path.join(process.cwd(), 'data', 'solicitation-workflows.json')

export const DEFAULT_TEMPLATE: WorkflowTemplateDraft = {
  subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}',
  body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}',
}

function normalizeTemplate(input?: Partial<WorkflowTemplateDraft> | null): WorkflowTemplateDraft {
  const subject = input?.subject?.trim() || DEFAULT_TEMPLATE.subject
  const body = input?.body?.trim() || DEFAULT_TEMPLATE.body
  return { subject, body }
}

function normalizeStep(step: WorkflowStepDraft): WorkflowStepDraft {
  const ids = step.approverUserIds?.filter(Boolean) ?? []
  const fallbackLegacy = step.approverUserId ? [step.approverUserId] : []
  const approverUserIds = Array.from(new Set([...ids, ...fallbackLegacy]))

  return {
    ...step,
    notificationEmails: Array.from(new Set((step.notificationEmails ?? []).map((x) => x.trim()).filter(Boolean))),
    approverUserIds,
    notificationTemplate: normalizeTemplate(step.notificationTemplate),
    approvalTemplate: normalizeTemplate(step.approvalTemplate),
  }
}

async function ensureDb() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    await fs.writeFile(DB_FILE, '[]', 'utf8')
  }
}

export async function readWorkflowRows() {
  await ensureDb()
  const raw = await fs.readFile(DB_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  const rows = Array.isArray(parsed) ? (parsed as WorkflowDraft[]) : []
  return rows.map((row) => ({
    ...row,
    steps: [...(row.steps ?? [])].sort((a, b) => a.order - b.order).map(normalizeStep),
  }))
}

async function writeWorkflowRows(rows: WorkflowDraft[]) {
  await ensureDb()
  await fs.writeFile(DB_FILE, JSON.stringify(rows, null, 2), 'utf8')
}

export async function createWorkflowRow(input: WorkflowDraft) {
  const rows = await readWorkflowRows()
  const nowId = input.id ?? crypto.randomUUID()
  const row: WorkflowDraft = {
    ...input,
    id: nowId,
    departmentId: input.departmentId ?? null,
    steps: [...input.steps].sort((a, b) => a.order - b.order).map(normalizeStep),
  }
  rows.push(row)
  await writeWorkflowRows(rows)
  return row
}

export async function updateWorkflowRow(id: string, input: WorkflowDraft) {
  const rows = await readWorkflowRows()
  const idx = rows.findIndex((row) => row.id === id)
  if (idx < 0) return null
  rows[idx] = {
    ...input,
    id,
     departmentId: input.departmentId ?? null,
    steps: [...input.steps].sort((a, b) => a.order - b.order).map(normalizeStep),
  }
  await writeWorkflowRows(rows)
  return rows[idx]
}