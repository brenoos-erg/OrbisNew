import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { getEffectiveDocumentPermissions, canManageDocumentRoles } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from '../../http'
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) { try { const me = await requireActiveUser(); const { userId } = await params; if (me.id !== userId && !(await canManageDocumentRoles(me.id, me.role))) throw new Error('Acesso negado.'); return NextResponse.json({ items: await getEffectiveDocumentPermissions(userId) }) } catch (error) { return documentRoleApiError(error) } }
