import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

// helper p/ admin
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes')
  return createClient(url, key)
}

export async function GET() {
  try {
    const list = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true },
    })
    return NextResponse.json(list, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /configuracoes/usuarios', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '').trim() || null
    const costCenter = (body.costCenter ?? '').trim() || null
    const firstAccess = !!body.firstAccess
    const password = (body.password ?? '').trim() || (firstAccess ? 'Temp123!' : '')

    if (!fullName || !email || !login) {
      return NextResponse.json({ error: 'Nome, e-mail e login são obrigatórios.' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Informe uma senha ou marque "primeiro acesso".' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data: createdAuth, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName, login, phone, costCenter },
      app_metadata: { first_access: firstAccess },
    })
    if (authErr || !createdAuth?.user) {
      return NextResponse.json({ error: authErr?.message || 'Falha no Auth.' }, { status: 500 })
    }

    try {
      const user = await prisma.user.create({
        data: { fullName, email, login, phone, costCenter, authId: createdAuth.user.id },
        select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true },
      })
      return NextResponse.json(user, { status: 201 })
    } catch (dbErr: any) {
      await admin.auth.admin.deleteUser(createdAuth.user.id).catch(() => {})
      if (dbErr?.code === 'P2002') {
        const alvo = Array.isArray(dbErr?.meta?.target) ? dbErr.meta.target.join(', ') : dbErr?.meta?.target ?? 'campo único'
        return NextResponse.json({ error: `Violação de UNIQUE: ${alvo}` }, { status: 409 })
      }
      throw dbErr
    }
  } catch (e: any) {
    console.error('POST /configuracoes/usuarios', e)
    return NextResponse.json({ error: e?.message || 'Erro ao criar usuário.' }, { status: 500 })
  }
}
