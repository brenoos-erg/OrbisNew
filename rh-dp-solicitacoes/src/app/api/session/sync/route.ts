import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

export async function POST() {
  // cliente público (ok para pegar o user da sessão)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  await prisma.user.upsert({
    where: { email: user.email! },
    update: {
      name: user.user_metadata?.name ?? user.email!,
      authId: user.id, // se você adicionou esse campo no Prisma
    },
    create: {
      email: user.email!,
      name: user.user_metadata?.name ?? user.email!,
      role: 'COLABORADOR',
      authId: user.id, // se existir no schema
    },
  })

  return NextResponse.json({ ok: true })
}
