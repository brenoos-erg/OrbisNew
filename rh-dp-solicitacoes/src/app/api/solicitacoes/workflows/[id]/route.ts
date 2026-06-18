import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { canFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
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
  const appUser = await requireActiveUser()
  const allowed = await canFeature(
    appUser.id,
    MODULE_KEYS.SOLICITACOES,
    FEATURE_KEYS.SOLICITACOES.FLUXOS,
    'UPDATE',
  )

  if (!allowed) {
    return NextResponse.json({ error: 'Sem permissão para editar workflow.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!isWorkflowDraft(body)) {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const updated = await updateWorkflowRow(id, body, {
    actorId: appUser.id,
    action: 'UPDATE',
    ip: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  })

  if (!updated) {
    return NextResponse.json({ error: 'Workflow não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(updated)
}
