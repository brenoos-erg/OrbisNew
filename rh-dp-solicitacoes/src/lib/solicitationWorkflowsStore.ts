import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type WorkflowStepKind = 'DEPARTAMENTO' | 'APROVACAO' | 'FIM'

export type WorkflowStepDraft = {
  order: number
  stepKey: string
  label: string
  kind: WorkflowStepKind
  defaultDepartmentId?: string | null
  approverGroupId?: string | null
  approverUserId?: string | null
  requiresApproval?: boolean
  canAssume?: boolean
  canFinalize?: boolean
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
  return Array.isArray(parsed) ? (parsed as WorkflowDraft[]) : []
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
    steps: [...input.steps].sort((a, b) => a.order - b.order),
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
    steps: [...input.steps].sort((a, b) => a.order - b.order),
  }
  await writeWorkflowRows(rows)
  return rows[idx]
}