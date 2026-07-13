import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDocumentContextByVersionId, hasDocumentPermission, matchesDocumentRoleScope } from '@/lib/documents/documentRoleAccess'
import { sendDocumentNotification } from '@/lib/documents/documentNotificationService'

async function canDecideSegregationException(userId: string, versionId: string) {
  const context = await getDocumentContextByVersionId(versionId)
  if (!(await hasDocumentPermission(userId, 'CAN_MANAGE_DOCUMENT_ROLES', context))) return false
  const now = new Date()
  const assignments = await prisma.documentRoleAssignment.findMany({
    where: { userId, role: 'DOCUMENT_MANAGER', active: true, OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] },
  })
  return assignments.some((assignment) => matchesDocumentRoleScope(assignment, context))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  const { id } = await params
  const body = await req.json().catch(() => null) ?? {}
  const reason = String(body.reason ?? body.decisionReason ?? '').trim()
  if (reason.length < 10) return NextResponse.json({ error: 'Motivo da aprovação da exceção é obrigatório e deve ter no mínimo 10 caracteres.' }, { status: 400 })
  const item = await prisma.documentSegregationException.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Exceção não encontrada.' }, { status: 404 })
  if (item.requestedById === me.id) return NextResponse.json({ error: 'Solicitante não pode aprovar a própria exceção.' }, { status: 403 })
  if (!(await canDecideSegregationException(me.id, item.versionId))) return NextResponse.json({ error: 'Somente outro gestor documental ativo e no escopo do documento pode decidir exceções.' }, { status: 403 })
  if (item.status !== 'PENDING') return NextResponse.json({ error: 'Exceção não está pendente.' }, { status: 409 })
  const decided = await prisma.documentSegregationException.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', pendingKey: null, decidedById: me.id, decidedAt: new Date(), decisionReason: reason } })
  if (decided.count !== 1) return NextResponse.json({ error: 'Exceção foi decidida por outro usuário.' }, { status: 409 })
  const updated = await prisma.documentSegregationException.findUniqueOrThrow({ where: { id } })
  await prisma.documentAuditLog.create({ data: { documentId: item.documentId, versionId: item.versionId, userId: me.id, action: 'SEGREGATION_EXCEPTION_APPROVED', reason, metadata: { exceptionId: id, conflictType: item.conflictType } } })
  void sendDocumentNotification('SEGREGATION_EXCEPTION_APPROVED', { documentId: item.documentId, versionId: item.versionId, actorUserId: me.id }).catch((error) => console.error('SEGREGATION_EXCEPTION_APPROVED notification failed', error))
  return NextResponse.json(updated)
}
