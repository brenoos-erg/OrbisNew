import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from '../../http'
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) { try { const me = await requireActiveUser(); if (!(await canManageDocumentRoles(me.id, me.role))) throw new Error('Acesso negado.'); const { userId } = await params; const items = await prisma.documentRoleAuditLog.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: 'desc' }, include: { actorUser: { select: { fullName: true, email: true } }, assignment: true } }); return NextResponse.json({ items }) } catch (error) { return documentRoleApiError(error) } }
