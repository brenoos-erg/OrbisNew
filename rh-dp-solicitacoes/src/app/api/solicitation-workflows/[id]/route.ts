import { NextResponse } from 'next/server'
import { updateWorkflowRow, type WorkflowDraft } from '@/lib/solicitationWorkflowsStore'

function isWorkflowDraft(value: unknown): value is WorkflowDraft {
  if (!value || typeof value !== 'object') return false
  const v = value as WorkflowDraft
  return Boolean(v.name && v.tipoId && Array.isArray(v.steps) && Array.isArray(v.transitions))
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!isWorkflowDraft(body)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const updated = await updateWorkflowRow(id, body)
  if (!updated) {
    return NextResponse.json({ error: 'Workflow não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(updated)
}