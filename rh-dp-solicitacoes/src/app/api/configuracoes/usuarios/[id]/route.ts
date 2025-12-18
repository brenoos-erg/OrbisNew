import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Admin client (Service Role) – só no servidor. Retorna null se não houver credenciais.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('Supabase admin credentials missing; skipping Auth sync.')
    return null
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** GET: retorna dados do usuário */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, fullName: true, email: true, login: true, phone: true,
        costCenterId: true,
        costCenter: { select: { description: true } },
      },
    })
    if (!u) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })

    return NextResponse.json({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      login: u.login ?? '',
      phone: u.phone ?? '',
      costCenterId: u.costCenterId ?? null,
      costCenterName: u.costCenter?.description ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Falha ao carregar usuário.' }, { status: 500 })
  }
}

/** PATCH: atualiza no Prisma e reflete no Auth (se houver authId) */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const id = params.id

    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '').trim() || null
    const costCenterId = (body.costCenterId ?? '').trim() || null
    const password = (body.password ?? '').trim()

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
        phone: true, costCenterId: true, authId: true,
      },
    })

    // Reflete no Auth (se houver authId)
    if (updated.authId) {
      const admin = getSupabaseAdmin()

      if (admin) {
        const updates: Record<string, any> = {}
        if (email) updates.email = email

        const meta: Record<string, any> = {}
        if (fullName) meta.fullName = fullName
        if (login) meta.login = login
        meta.phone = phone
        meta.costCenterId = costCenterId

        updates.user_metadata = meta

        const { error: upErr } = await admin.auth.admin.updateUserById(updated.authId, updates)
        if (upErr) console.error('supabase admin update error', upErr)

        if (password) {
          const { error: passErr } = await admin.auth.admin.updateUserById(updated.authId, { password })
          if (passErr) console.error('supabase admin set password error', passErr)
        }
      } else {
        console.warn('Supabase admin credentials missing; skipping Auth sync for update.')
      }
    }

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      login: updated.login ?? '',
      phone: updated.phone ?? '',
      costCenterId: updated.costCenterId ?? null,
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Violação de UNIQUE (email/login).' }, { status: 409 })
    }
    console.error('PATCH /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 })
  }
}

/**
 * DELETE: remove do Prisma e também do Auth (se houver credenciais e authId)
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, authId: true },
    })
if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const admin = user.authId ? getSupabaseAdmin() : null

    if (user.authId && !admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY ausente. Não é possível excluir no Auth.' },
        { status: 500 },
      )
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.userCostCenter.deleteMany({ where: { userId: id } })
        await tx.userModuleAccess.deleteMany({ where: { userId: id } })
        await tx.groupMember.deleteMany({ where: { userId: id } })

        await tx.user.delete({ where: { id } })
      })
    } catch (dbErr: any) {
      console.error('DELETE /configuracoes/usuarios/[id] prisma error', dbErr)

      if (dbErr?.code === 'P2003') {
        return NextResponse.json(
          {
            error:
              'Não é possível excluir: existem registros relacionados a este usuário. ' +
              'Caso precise remover, inative-o ou limpe vínculos antes de tentar novamente.',
          },
          { status: 409 },
        )
      }

      return NextResponse.json({ error: 'Erro ao excluir no banco de dados.' }, { status: 500 })
    }

    if (user.authId && admin) {
      const { error: authErr } = await admin.auth.admin.deleteUser(user.authId)

      if (authErr) {
        console.error('DELETE /configuracoes/usuarios/[id] auth error', authErr)
        return NextResponse.json(
          {
            error:
              'Usuário removido do banco, mas falhou ao apagar no Supabase Auth: ' +
              authErr.message,
          },
          { status: 500 },
        )
      }
    }
     return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('DELETE /configuracoes/usuarios/[id] error', e)
    return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 })
  }
}