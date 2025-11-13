// src/app/api/session/sync/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Se não tiver sessão, não faz nada
  if (!session?.user) {
    return NextResponse.json({ ok: true })
  }

  const authId = session.user.id
  const email = session.user.email ?? ''
  const name = (session.user.user_metadata as any)?.name ?? ''

  const appUser = await prisma.user.upsert({
    where: { authId }, // authId precisa ser @unique no schema
    create: {
      authId,
      email,
      fullName: name || email, // usa name se tiver, senão o email como fallback
      status: 'ATIVO',
    },
    update: {
      // ⚠️ IMPORTANTE:
      // não mexer em fullName aqui para não apagar o nome cadastrado no painel
      email,
      // Se algum dia QUISER atualizar o nome só quando vier preenchido,
      // pode usar algo assim:
      // ...(name ? { fullName: name } : {}),
    },
    select: { id: true, status: true },
  })

  return NextResponse.json({ ok: true, appUser })
}
