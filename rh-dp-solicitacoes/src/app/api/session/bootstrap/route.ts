export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getCurrentAppUser } from '@/lib/auth'

export async function GET() {
  const { appUser, session, dbUnavailable } = await getCurrentAppUser()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!appUser) return NextResponse.json({ error: 'Usuário não encontrado no banco', dbUnavailable }, { status: dbUnavailable ? 503 : 404 })
  return NextResponse.json({ appUser, session, dbUnavailable })
}