// src/app/api/session/sync/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'
import { generateLoginFromFullName } from '@/lib/login' // <-- helper já existe

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createRouteHandlerClient({ cookies: async () => cookieStore })

  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) return NextResponse.json({ ok: false }, { status: 401 })

  const meta = user.user_metadata || {}
  const fullName = (meta.fullName || meta.name || user.email) as string

  // tenta vir do metadata; se não houver, gera a partir do nome
  let login: string | null | undefined = (meta.login as string | undefined)?.trim()
  if (!login) {
    // se quiser gerar automaticamente, use o helper que já existe
    // (ele garante unicidade no banco)
    login = await generateLoginFromFullName(fullName)  // helper: :contentReference[oaicite:1]{index=1}
  }

  await prisma.user.upsert({
    where: { email: user.email! },
    update: { fullName, authId: user.id, login },
    create: { email: user.email!, fullName, authId: user.id, login },
  })

  return NextResponse.json({ ok: true })
}
