import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageDocumentRoles } from '@/lib/documents/documentRoleAccess'

export async function GET(req: NextRequest) {
  const me = await requireActiveUser()
  if (!(await canManageDocumentRoles(me.id, me.role))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  const status = req.nextUrl.searchParams.get('status') || undefined
  const items = await prisma.documentSegregationException.findMany({ where: { ...(status ? { status: status as any } : {}) }, include: { document: { select: { code: true, title: true } }, version: { select: { revisionNumber: true } }, requestedBy: { select: { fullName: true, email: true } }, decidedBy: { select: { fullName: true, email: true } } }, orderBy: { requestedAt: 'desc' }, take: 200 })
  return NextResponse.json({ items })
}
