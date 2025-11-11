// src/app/api/configuracoes/usuarios/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // como tipamos as envs no env.d.ts, não precisa mais de "!"
  return createClient(url, key)
}

type PatchBody = {
  fullName?: string
  email?: string
  login?: string
  phone?: string | null
  costCenterId?: string | null
  password?: string
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as PatchBody
    const id = params.id

    const fullName = (body.fullName ?? '').trim()
    const email    = (body.email ?? '').trim().toLowerCase()
    const login    = (body.login ?? '').trim().toLowerCase()
    const phone    = (body.phone ?? '') || null
    const costCenterId = (body.costCenterId ?? '').trim() || null
    const password = (body.password ?? '').trim()

    // 1) Atualiza no Prisma
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(email    ? { email }    : {}),
        ...(login    ? { login }    : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(costCenterId !== undefined ? { costCenterId } : {}),
      },
      select: { id: true, email: true, fullName: true, login: true, phone: true, costCenterId: true, authId: true },
    })

    // 2) Reflete no Auth (se tiver authId)
    if (updated.authId) {
      const sb = getSupabaseAdmin()
      const updates: Record<string, any> = {}

      if (email) updates.email = email
      if (fullName) updates.data = { ...(updates.data || {}), fullName }
      if (login)    updates.data = { ...(updates.data || {}), login }
      if (phone !== undefined) updates.data = { ...(updates.data || {}), phone }
      if (costCenterId !== undefined) updates.data = { ...(updates.data || {}), costCenterId }

      if (Object.keys(updates).length > 0) {
        const { error } = await sb.auth.admin.updateUserById(updated.authId, updates)
        if (error) console.error('supabase admin update error', error)
      }

      if (password) {
        const { error } = await sb.auth.admin.updateUserById(updated.authId, { password })
        if (error) console.error('supabase admin set password error', error)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('PATCH /api/configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
