// src/app/api/configuracoes/usuarios/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Admin client (Service Role) – só no servidor
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

/** PATCH: atualiza no Prisma e reflete no Auth (se houver authId) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const id = params.id

    const fullName   = (body.fullName ?? '').trim()
    const email      = (body.email ?? '').trim().toLowerCase()
    const login      = (body.login ?? '').trim().toLowerCase()
    const phone      = (body.phone ?? '').trim() || null
    const costCenterId = (body.costCenterId ?? '').trim() || null
    const password   = (body.password ?? '').trim()

    // Atualiza no Prisma
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(email ? { email } : {}),
        ...(login ? { login } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(costCenterId !== undefined ? { costCenterId } : {}),
      },
      select: {
        id: true, fullName: true, email: true, login: true,
        phone: true, costCenterId: true, authId: true
      },
    })

    // Reflete no Auth (se houver authId)
    if (updated.authId) {
      const admin = getSupabaseAdmin()

      const updates: Record<string, any> = {}
      if (email) updates.email = email

      const meta: Record<string, any> = {}
      if (fullName) meta.fullName = fullName
      if (login) meta.login = login
      if (phone !== undefined) meta.phone = phone
      if (costCenterId !== undefined) meta.costCenterId = costCenterId
      if (Object.keys(meta).length > 0) updates.user_metadata = meta

      const { error: upErr } = await admin.auth.admin.updateUserById(updated.authId, updates)
      if (upErr) console.error('supabase admin update error', upErr)

      if (password) {
        const { error: passErr } = await admin.auth.admin.updateUserById(updated.authId, { password })
        if (passErr) console.error('supabase admin set password error', passErr)
      }
    }

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      login: updated.login ?? '',
      phone: updated.phone ?? '',
      costCenterId: updated.costCenterId ?? '',
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Violação de UNIQUE (email/login).' }, { status: 409 })
    }
    console.error('PATCH /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 })
  }
}

/** DELETE: remove no Prisma e depois tenta remover no Auth (best-effort) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // 1) pega authId antes
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, authId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    // 2) exclui no Prisma primeiro (respeita FKs e garante consistência)
    await prisma.user.delete({ where: { id } })

    // 3) tenta excluir no Auth (não falha a resposta se der erro)
    if (existing.authId) {
      const admin = getSupabaseAdmin()
      await admin.auth.admin.deleteUser(existing.authId).catch((err) => {
        console.error('Falha ao excluir no Auth (seguindo mesmo assim):', err)
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2003' || e?.code === '23503') {
      return NextResponse.json(
        { error: 'Não é possível excluir: existem registros vinculados a este usuário.' },
        { status: 409 }
      )
    }
    console.error('DELETE /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 })
  }
}
