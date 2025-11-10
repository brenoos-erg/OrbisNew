import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

// sessão
async function requireSession() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data } = await supabase.auth.getSession()
    return data.session
  } catch (err) {
    console.error('requireSession() failed', err)
    return null
  }
}

// admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key)
}

// ============== PATCH: atualizar usuário =================
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const body = await req.json()
    const id = params.id

    const fullName   = (body.fullName ?? '').trim()
    const email      = (body.email ?? '').trim().toLowerCase()
    const login      = (body.login ?? '').trim().toLowerCase()
    const phone      = (body.phone ?? '').trim() || null
    const costCenter = (body.costCenter ?? '').trim() || null
    const password   = (body.password ?? '').trim()

    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, authId: true }
    })
    if (!current) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName   ? { fullName }   : {}),
        ...(email      ? { email }      : {}),
        ...(login      ? { login }      : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(costCenter !== undefined ? { costCenter } : {}),
      },
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true, authId: true },
    })

    if (updated.authId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.updateUserById(updated.authId, {
        ...(email ? { email } : {}),
        ...(password ? { password } : {}),
        user_metadata: {
          ...(fullName ? { fullName } : {}),
          ...(login ? { login } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(costCenter !== undefined ? { costCenter } : {}),
        },
      })
    }

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      login: updated.login ?? '',
      phone: updated.phone ?? '',
      costCenter: updated.costCenter ?? ''
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const alvo = Array.isArray(e?.meta?.target) ? e.meta.target.join(', ') : (e?.meta?.target ?? 'campo único')
      return NextResponse.json({ error: `Violação de UNIQUE: ${alvo}` }, { status: 409 })
    }
    console.error('PATCH /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar usuário.' }, { status: 500 })
  }
}

// ============== DELETE: apagar usuário =================
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const { id } = params

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, authId: true }
    })
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    await prisma.user.delete({ where: { id } })

    if (existing.authId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.deleteUser(existing.authId).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 })
  }
}
