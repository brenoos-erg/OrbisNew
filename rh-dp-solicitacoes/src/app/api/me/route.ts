import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: async () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({}, { status: 401 })

  const me = await prisma.user.findFirst({
    where: { authId: session.user.id },
    select: { fullName: true, email: true },
  })

  return NextResponse.json(me ?? {})
}
