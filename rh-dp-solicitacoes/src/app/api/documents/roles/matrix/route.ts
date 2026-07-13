import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { DOCUMENT_ROLE_LABELS, ROLE_DEFAULT_PERMISSIONS } from '@/lib/documents/documentRoleAccess'
import { documentRoleApiError } from '../http'
export async function GET() { try { await requireActiveUser(); return NextResponse.json({ roles: DOCUMENT_ROLE_LABELS, matrix: ROLE_DEFAULT_PERMISSIONS }) } catch (error) { return documentRoleApiError(error) } }
