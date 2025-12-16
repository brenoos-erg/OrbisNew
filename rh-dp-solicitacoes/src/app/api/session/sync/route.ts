// src/app/api/session/sync/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
data: { user },
  } = await supabase.auth.getUser()

  // Se não tiver sessão, não faz nada
  if (!user) {
    return NextResponse.json({ ok: true })
  }

  const authId = user.id
  const email = user.email ?? ''
  const name = (user.user_metadata as any)?.name ?? ''

     try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error(
        'Não foi possível conectar ao banco de dados para sincronizar usuário',
        error,
      )
      return NextResponse.json({
        ok: false,
        dbUnavailable: true,
        error: 'Falha ao conectar ao banco de dados para sincronizar usuário',
      }, { status: 503 })
    }

    console.error('Erro ao sincronizar usuário no banco de dados', error)
    return NextResponse.json(
      { ok: false, error: 'Erro ao sincronizar usuário' },
      { status: 500 },
    )
  }
}
