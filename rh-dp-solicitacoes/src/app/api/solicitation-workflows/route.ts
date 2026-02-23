import { NextResponse } from 'next/server'
import { createWorkflowRow, readWorkflowRows, type WorkflowDraft } from '@/lib/solicitationWorkflowsStore'
import { prisma } from '@/lib/prisma'

function isWorkflowDraft(value: unknown): value is WorkflowDraft {
  if (!value || typeof value !== 'object') return false
  const v = value as WorkflowDraft
  return Boolean(v.name && v.tipoId && Array.isArray(v.steps) && Array.isArray(v.transitions))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tipoId = searchParams.get('tipoId')
  const departmentId = searchParams.get('departmentId')

  const rows = await readWorkflowRows()
  const filtered = rows.filter((row) => {
    if (tipoId && row.tipoId !== tipoId) return false
    if (departmentId && (row.departmentId ?? null) !== departmentId) return false
    return true
  })

  const tipoIds = [...new Set(filtered.map((r) => r.tipoId))]
  const depIds = [...new Set(filtered.map((r) => r.departmentId).filter(Boolean) as string[])]
  const [tipos, departments] = await Promise.all([
    tipoIds.length
      ? prisma.tipoSolicitacao.findMany({ where: { id: { in: tipoIds } }, select: { id: true, nome: true } })
      : Promise.resolve([]),
    depIds.length
      ? prisma.department.findMany({ where: { id: { in: depIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ])

  const tipoMap = new Map(tipos.map((t) => [t.id, t]))
  const depMap = new Map(departments.map((d) => [d.id, d]))

  const response = filtered.map((row) => ({
    ...row,
    tipo: tipoMap.get(row.tipoId) ?? null,
    department: row.departmentId ? depMap.get(row.departmentId) ?? null : null,
    steps: row.steps.map((step) => ({
      ...step,
      kind:
        step.kind === 'DEPARTAMENTO'
          ? 'QUEUE'
          : step.kind === 'APROVACAO'
            ? 'APPROVAL'
            : 'END',
      defaultDepartment: step.defaultDepartmentId
        ? depMap.get(step.defaultDepartmentId) ?? null
        : null,
      requiresApproval: Boolean(step.requiresApproval),
      canAssume: Boolean(step.canAssume),
      canFinalize: Boolean(step.canFinalize),
    })),
  }))

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!isWorkflowDraft(body)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const created = await createWorkflowRow(body)
  return NextResponse.json(created, { status: 201 })
}