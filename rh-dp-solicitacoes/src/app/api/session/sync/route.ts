import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: async () => cookieStore })

  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) return NextResponse.json({ ok: false }, { status: 401 })

  await prisma.user.upsert({
    where: { email: user.email! },
    update: { fullName: user.user_metadata?.name ?? user.email!, authId: user.id },
    create: { email: user.email!, fullName: user.user_metadata?.name ?? user.email!, authId: user.id },
  })

  return NextResponse.json({ ok: true })
}
