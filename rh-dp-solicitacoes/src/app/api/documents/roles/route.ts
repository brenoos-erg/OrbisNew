import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles, createDocumentRoleAudit, detectSegregationConflicts, normalizeDocumentRoleInput } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from './http'

async function assertCanManage(userId: string, role?: string | null) { if (!(await canManageDocumentRoles(userId, role))) throw new Error('Acesso negado.') }

export async function GET(req: NextRequest) {
  try {
    const me = await requireActiveUser(); await assertCanManage(me.id, me.role)
    const { searchParams } = new URL(req.url)
    const page = Math.max(Number(searchParams.get('page') || 1), 1)
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') || 20), 1), 100)
    const where: any = {}
    if (searchParams.get('userId')) where.userId = searchParams.get('userId')
    if (searchParams.get('role')) where.role = searchParams.get('role')
    if (searchParams.get('scopeType')) where.scopeType = searchParams.get('scopeType')
    if (searchParams.get('active')) where.active = searchParams.get('active') === 'true'
    if (searchParams.get('q')) where.user = { OR: [{ fullName: { contains: searchParams.get('q')! } }, { email: { contains: searchParams.get('q')! } }] }
    const [items, total] = await Promise.all([
      prisma.documentRoleAssignment.findMany({ where, include: { user: { select: { id: true, fullName: true, email: true, department: true, costCenter: true, moduleAccesses: { where: { module: { key: 'controle-documentos' } }, select: { level: true } } } }, department: true, costCenter: true, documentType: true, document: { select: { id: true, code: true, title: true } }, approverGroup: true, createdBy: { select: { id: true, fullName: true } } }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.documentRoleAssignment.count({ where }),
    ])
    return NextResponse.json({ items, total, page, pageSize })
  } catch (error) { return documentRoleApiError(error) }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser(); await assertCanManage(me.id, me.role)
    const input = normalizeDocumentRoleInput(await req.json().catch(() => null))
    const duplicate = await prisma.documentRoleAssignment.findFirst({ where: { userId: input.userId, role: input.role, scopeType: input.scopeType, scopeKey: input.scopeKey } })
    if (duplicate) throw new Error('Atribuição duplicada para usuário, papel e escopo existentes; reative a atribuição inativa quando aplicável.')
    const existingRoles = await prisma.documentRoleAssignment.findMany({ where: { userId: input.userId, active: true, scopeType: input.scopeType, scopeKey: input.scopeKey }, select: { role: true } })
    const conflicts = detectSegregationConflicts([...existingRoles.map((item) => item.role), input.role])
    if (conflicts.length && !input.justification) throw new Error('Conflito de segregação exige justificativa.')
    const created = await prisma.$transaction(async (tx) => {
      const assignment = await tx.documentRoleAssignment.create({ data: { ...input, createdById: me.id } })
      await createDocumentRoleAudit(tx, { assignmentId: assignment.id, targetUserId: assignment.userId, actorUserId: me.id, action: 'DOCUMENT_ROLE_ASSIGNED', after: assignment, justification: assignment.justification })
      for (const conflict of conflicts) await createDocumentRoleAudit(tx, { assignmentId: assignment.id, targetUserId: assignment.userId, actorUserId: me.id, action: 'SEGREGATION_CONFLICT_DETECTED', after: assignment, justification: assignment.justification, conflictType: conflict })
      return assignment
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) { return documentRoleApiError(error) }
}
