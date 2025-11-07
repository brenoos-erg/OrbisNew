import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key)
}

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const body = await _.json()
    const data: any = {
      fullName: (body.fullName ?? '').trim(),
      email: (body.email ?? '').trim().toLowerCase(),
      login: (body.login ?? '').trim().toLowerCase(),
      phone: (body.phone ?? '').trim() || null,
      costCenter: (body.costCenter ?? '').trim() || null,
    }

    const userBefore = await prisma.user.findUnique({ where: { id }, select: { authId: true } })
    if (!userBefore) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true, authId: true },
    })

    // Atualiza Auth (e senha, se enviada)
    if (updated.authId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.updateUserById(updated.authId, {
        email: updated.email,
        user_metadata: { fullName: updated.fullName, login: updated.login, phone: updated.phone, costCenter: updated.costCenter },
        password: body.password ? String(body.password) : undefined,
      })
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    console.error('PATCH /configuracoes/usuarios/[id]', e)
    return NextResponse.json({ error: e?.message || 'Erro ao atualizar.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const id = params.id
  try {
    const found = await prisma.user.findUnique({ where: { id }, select: { authId: true } })
    if (!found) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

    await prisma.user.delete({ where: { id } })
    if (found.authId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.deleteUser(found.authId).catch(() => {})
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /configuracoes/usuarios/[id]', e)
    return NextResponse.json({ error: e?.message || 'Erro ao excluir.' }, { status: 500 })
  }
}
