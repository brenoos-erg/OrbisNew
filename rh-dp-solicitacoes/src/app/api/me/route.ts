// src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// =======================
// GET /api/me
// =======================
export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({}, { status: 401 })
  }

  const email = session.user.email!

  const me = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      role: true,
      costCenter: true,
      department: true,
      // se quiser depois usar permissões no front, dá para expor:
      // moduleAccesses: {
      //   select: {
      //     level: true,
      //     module: { select: { key: true, name: true } },
      //   },
      // },
    },
  })

  return NextResponse.json(me ?? {})
}

// =======================
// PATCH /api/me
// =======================
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))

    const {
      fullName,
      phone,
      costCenterId,
      departmentId,
      // metadata extras
      avatarUrl,
      position,
      leaderName,
    } = body as Record<string, any>

    const email = session.user.email!

    // 1) Garante que existe um user no Prisma para este e-mail
    let dbUser = await prisma.user.findUnique({ where: { email } })

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email,
          fullName: session.user.user_metadata?.name ?? email,
          login: email.split('@')[0],
          authId: session.user.id, // UUID do Supabase (compatível com @db.Uuid)
        },
      })
    }

    // 2) Atualiza por ID (que é unique de verdade)
    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        ...(typeof fullName === 'string' ? { fullName } : {}),
        ...(typeof phone === 'string' ? { phone } : {}),
        ...(typeof costCenterId === 'string' ? { costCenterId } : {}),
        ...(typeof departmentId === 'string' ? { departmentId } : {}),
        ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        login: true,
        phone: true,
        role: true,
        costCenter: true,
        department: true,
      },
    })

    // 3) Atualiza metadata do Supabase (opcional, só o que fizer sentido no front)
    const metaPatch: Record<string, any> = {}
    if (typeof avatarUrl === 'string') metaPatch.avatarUrl = avatarUrl
    if (typeof position === 'string') metaPatch.position = position
    if (typeof departmentId === 'string') metaPatch.departmentId = departmentId
    if (typeof leaderName === 'string') metaPatch.leaderName = leaderName

    if (Object.keys(metaPatch).length) {
      const { error } = await supabase.auth.updateUser({ data: metaPatch })
      if (error) console.warn('updateUser metadata warning:', error)
      await supabase.auth.refreshSession()
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH /api/me error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao atualizar perfil.' },
      { status: 500 },
    )
  }
}
