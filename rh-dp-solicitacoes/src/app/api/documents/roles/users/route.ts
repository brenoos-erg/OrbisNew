import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from '../http'
export async function GET() { try { const me = await requireActiveUser(); if (!(await canManageDocumentRoles(me.id, me.role))) throw new Error('Acesso negado.'); const users = await prisma.user.findMany({ where: { status: 'ATIVO' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, login: true, role: true, department: true, costCenter: true } }); return NextResponse.json({ users }) } catch (error) { return documentRoleApiError(error) } }
