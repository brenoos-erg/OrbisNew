import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET (sem mudanças, só certifica cookies() sem await)
export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({}, { status: 401 })

  const me = await prisma.user.findFirst({
    where: { email: session.user.email! },             // <- email é único no schema
    select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true, role: true },
  })

  return NextResponse.json(me ?? {})
}

// PATCH (corrigido)
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const {
      fullName,
      phone,
      costCenter,
      // metadata
      avatarUrl,
      position,
      department,
      leaderName,
    } = body as Record<string, any>

    // 1) Garante que existe um user no Prisma para este e-mail
    const email = session.user.email!
    let dbUser = await prisma.user.findUnique({ where: { email } })

    if (!dbUser) {
      // cria espelho básico se ainda não existir
      dbUser = await prisma.user.create({
        data: {
          email,
          fullName: session.user.user_metadata?.name ?? email,
          login: email.split('@')[0],
          authId: session.user.id, // não é unique, mas guardamos como referência
        },
        select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true, role: true },
      })
    }

    // 2) Atualiza por ID (campo unique de verdade)
    const updated = await prisma.user.update({
      where: { id: dbUser.id }, // <- AQUI está a correção principal
      data: {
        ...(typeof fullName === 'string'   ? { fullName }   : {}),
        ...(typeof phone === 'string'      ? { phone }      : {}),
        ...(typeof costCenter === 'string' ? { costCenter } : {}),
      },
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true, role: true },
    })

    // 3) Atualiza metadata do Supabase
    const metaPatch: Record<string, any> = {}
    if (typeof avatarUrl  === 'string') metaPatch.avatarUrl  = avatarUrl
    if (typeof position   === 'string') metaPatch.position   = position
    if (typeof department === 'string') metaPatch.department = department
    if (typeof leaderName === 'string') metaPatch.leaderName = leaderName

    if (Object.keys(metaPatch).length) {
      const { error } = await supabase.auth.updateUser({ data: metaPatch })
      if (error) console.warn('updateUser metadata warning:', error)
      await supabase.auth.refreshSession()
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/me error', e)
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar perfil.' }, { status: 500 })
  }
}
