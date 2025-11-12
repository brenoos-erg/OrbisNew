import { NextResponse } from 'next/server'
import { getCurrentAppUser } from './auth'

export async function requireActiveUser() {
  const { appUser } = await getCurrentAppUser()

  if (!appUser) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }) }
  }
  if (appUser.status !== 'ATIVO') {
    return { ok: false as const, response: NextResponse.json({ error: 'User inactive' }, { status: 403 }) }
  }
  return { ok: true as const, user: appUser }
}
