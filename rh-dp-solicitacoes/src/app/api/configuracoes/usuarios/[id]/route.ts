import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

async function requireSession() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({
    cookies: async () => cookieStore,
  })
  const { data: { session } } = await supabase.auth.getSession()
  return { supabase, session }
}

export async function GET() {
  const { session } = await requireSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ items: users })
}
