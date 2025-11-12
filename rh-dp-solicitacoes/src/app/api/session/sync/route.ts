import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return NextResponse.json({ ok: true })

  const authId = session.user.id
  const email  = session.user.email ?? ''
  const name   = (session.user.user_metadata as any)?.name ?? ''

  const appUser = await prisma.user.upsert({
    where: { authId },               // ⚠️ precisa ser @unique no schema
    create: {
      authId, email, fullName: name,
      status: 'ATIVO',               // só na criação
    },
    update: {
      email, fullName: name,         // ❌ NÃO ALTERE status aqui
    },
    select: { id: true, status: true },
  })

  return NextResponse.json({ ok: true, appUser })
}
