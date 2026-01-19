export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies })

  await supabase.auth.signOut({ scope: 'global' })

  cookieStore.getAll().forEach((c) => {
    if (c.name.startsWith('sb-')) cookieStore.set(c.name, '', { path: '/', maxAge: 0 })
  })

  return NextResponse.json({ ok: true })
}