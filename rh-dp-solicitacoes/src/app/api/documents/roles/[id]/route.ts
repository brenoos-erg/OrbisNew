import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles, createDocumentRoleAudit, normalizeDocumentRoleInput, scopeSnapshot } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from '../http'
async function assertCanManage(userId: string, role?: string | null) { if (!(await canManageDocumentRoles(userId, role))) throw new Error('Acesso negado.') }
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const me = await requireActiveUser(); await assertCanManage(me.id, me.role); const { id } = await params; const item = await prisma.documentRoleAssignment.findUnique({ where: { id }, include: { user: true, department: true, costCenter: true, documentType: true, document: true, approverGroup: true, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20, include: { actorUser: { select: { fullName: true } } } } } }); if (!item) throw new Error('Atribuição não encontrada.'); return NextResponse.json(item) } catch (error) { return documentRoleApiError(error) }
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser(); await assertCanManage(me.id, me.role); const { id } = await params
    const before = await prisma.documentRoleAssignment.findUnique({ where: { id } }); if (!before) throw new Error('Atribuição não encontrada.')
    const input = normalizeDocumentRoleInput({ ...(await req.json().catch(() => null)), userId: before.userId, role: before.role })
    const duplicate = await prisma.documentRoleAssignment.findFirst({ where: { id: { not: id }, userId: before.userId, role: before.role, scopeType: input.scopeType, scopeKey: input.scopeKey } })
    if (duplicate) throw new Error('Atribuição duplicada para usuário, papel e escopo existentes; reative a atribuição inativa quando aplicável.')
    const updated = await prisma.$transaction(async (tx) => {
      const lockName = 'document-role-manager-guard'
      const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
      if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear a validação de gestores documentais.')
      try {
      const lockedBefore = await tx.documentRoleAssignment.findUnique({ where: { id } })
      if (!lockedBefore) throw new Error('Atribuição não encontrada.')
      if (lockedBefore.role === 'DOCUMENT_MANAGER') {
        const now = new Date()
        const wouldExpire = input.validUntil ? input.validUntil < now : false
        const wouldDisable = input.active === false || wouldExpire
        if (wouldDisable) {
          const remainingManagers = await tx.documentRoleAssignment.count({ where: { role: 'DOCUMENT_MANAGER', active: true, id: { not: id }, OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] } })
          if (remainingManagers < 1) throw new Error('Não é possível inativar o último gestor documental ativo.')
        }
        if (input.validUntil && input.validUntil >= now) {
          const managersAfterExpiry = await tx.documentRoleAssignment.count({ where: { role: 'DOCUMENT_MANAGER', active: true, id: { not: id }, OR: [{ validFrom: null }, { validFrom: { lte: input.validUntil } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gt: input.validUntil } }] }] } })
          if (managersAfterExpiry < 1) throw new Error('Não é possível deixar o último gestor documental com validade futura sem outro gestor válido após essa data.')
        }
      }
      const assignment = await tx.documentRoleAssignment.update({ where: { id }, data: { ...input, updatedById: me.id } })
      const scopeChanged = JSON.stringify(scopeSnapshot(lockedBefore)) !== JSON.stringify(scopeSnapshot(assignment))
      const validityChanged = String(lockedBefore.validFrom) !== String(assignment.validFrom) || String(lockedBefore.validUntil) !== String(assignment.validUntil)
      await createDocumentRoleAudit(tx, { assignmentId: id, targetUserId: assignment.userId, actorUserId: me.id, action: 'DOCUMENT_ROLE_UPDATED', before: lockedBefore, after: assignment, justification: input.justification })
      if (scopeChanged) await createDocumentRoleAudit(tx, { assignmentId: id, targetUserId: assignment.userId, actorUserId: me.id, action: 'DOCUMENT_SCOPE_CHANGED', before: lockedBefore, after: assignment, justification: input.justification })
      if (validityChanged) await createDocumentRoleAudit(tx, { assignmentId: id, targetUserId: assignment.userId, actorUserId: me.id, action: 'DOCUMENT_VALIDITY_CHANGED', before: lockedBefore, after: assignment, justification: input.justification })
      return assignment
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
      }
    })
    return NextResponse.json(updated)
  } catch (error) { return documentRoleApiError(error) }
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser(); await assertCanManage(me.id, me.role); const { id } = await params
    const before = await prisma.documentRoleAssignment.findUnique({ where: { id } }); if (!before) throw new Error('Atribuição não encontrada.')
    const body = await req.json().catch(() => null) ?? {}; const reason = String(body.reason ?? body.justification ?? '').trim(); if (!reason) throw new Error('Justificativa obrigatória para inativar papel.')
    const updated = await prisma.$transaction(async (tx) => {
      const lockName = 'document-role-manager-guard'
      const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
      if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear a validação de gestores documentais.')
      try {
      const lockedBefore = await tx.documentRoleAssignment.findUnique({ where: { id } })
      if (!lockedBefore) throw new Error('Atribuição não encontrada.')
      if (lockedBefore.role === 'DOCUMENT_MANAGER' && lockedBefore.active) {
        const now = new Date()
        const activeManagers = await tx.documentRoleAssignment.count({ where: { role: 'DOCUMENT_MANAGER', active: true, id: { not: id }, OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }] } })
        if (activeManagers < 1) throw new Error('Não é possível inativar o último gestor documental ativo.')
      }
      const assignment = await tx.documentRoleAssignment.update({ where: { id }, data: { active: false, disabledAt: new Date(), disabledById: me.id, disableReason: reason } })
      await createDocumentRoleAudit(tx, { assignmentId: id, targetUserId: assignment.userId, actorUserId: me.id, action: 'DOCUMENT_ROLE_DISABLED', before: lockedBefore, after: assignment, justification: reason })
      return assignment
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
      }
    })
    return NextResponse.json(updated)
  } catch (error) { return documentRoleApiError(error) }
}
