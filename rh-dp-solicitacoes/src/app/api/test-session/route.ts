export const dynamic = 'force-dynamic'
export const revalidate = 0

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'


export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data } = await supabase.auth.getUser()
  return NextResponse.json({ hasSession: !!data.user, user: data.user })
}