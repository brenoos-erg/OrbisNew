import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

// ===== helpers ==============================================================

function makeLogin(fullName: string) {
  const clean = fullName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().split(/\s+/)
  const first = clean[0] || ''
  const last  = clean.length > 1 ? clean[clean.length - 1] : ''
  return [first, last].filter(Boolean).join('.').replace(/[^a-z.]/g, '')
}

function genTempPassword() {
  // defina uma política melhor em produção
  return 'Temp123!'
}

type DbUser = {
  id: string
  fullName: string
  email: string
  login: string | null
  phone: string | null
  costCenter: string | null
  authId: string | null
}
const toApi = (u: DbUser) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  login: u.login ?? '',
  phone: u.phone ?? '',
  costCenter: u.costCenter ?? '',
  authId: u.authId ?? '',
})

// Cria o client admin somente quando for necessário
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Configuração ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  return createClient(url, key)
}

// ===== POST: cria em auth.users e em public."User" ==========================

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const fullName   = (body.fullName ?? '').trim()
    const email      = (body.email ?? '').trim().toLowerCase()
    const phone      = (body.phone ?? '').trim() || null
    const costCenter = (body.costCenter ?? '').trim() || null
    const firstAccess: boolean = !!body.firstAccess
    const incomingPassword: string = (body.password ?? '').trim()

    if (!fullName || !email) {
      return NextResponse.json(
        { error: 'Nome completo e e-mail são obrigatórios.' },
        { status: 400 }
      )
    }

    // login informado ou gerado
    const incomingLogin = (body.login ?? '').trim().toLowerCase()
    const login = incomingLogin || makeLogin(fullName)

    // regra de senha
    const password = incomingPassword || (firstAccess ? genTempPassword() : '')
    if (!password) {
      return NextResponse.json(
        { error: 'Informe uma senha ou marque "Usuário definirá a senha no primeiro acesso".' },
        { status: 400 }
      )
    }

    // Supabase Auth (Service Role)
    const supabaseAdmin = getSupabaseAdmin()
    const { data: createdAuth, error: authErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { fullName, login, phone, costCenter },
        app_metadata: { first_access: firstAccess },
      })

    if (authErr || !createdAuth?.user) {
      return NextResponse.json(
        { error: authErr?.message || 'Falha ao criar usuário no Auth.' },
        { status: 500 }
      )
    }

    const authUser = createdAuth.user

    // Public."User" (Prisma)
    try {
      const createdDb = await prisma.user.create({
        data: {
          fullName, email, login, phone, costCenter,
          authId: authUser.id,
        },
        select: {
          id: true, fullName: true, email: true, login: true,
          phone: true, costCenter: true, authId: true,
        },
      })

      return NextResponse.json(toApi(createdDb), { status: 201 })
    } catch (dbErr: any) {
      // rollback no Auth se deu erro ao gravar no banco
      await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {})
      if (dbErr?.code === 'P2002') {
        const alvo = Array.isArray(dbErr?.meta?.target)
          ? dbErr.meta.target.join(', ')
          : dbErr?.meta?.target ?? 'campo único'
        return NextResponse.json({ error: `Violação de UNIQUE: ${alvo}` }, { status: 409 })
      }
      throw dbErr
    }
  } catch (e: any) {
    console.error('POST /configuracoes/usuarios error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao criar usuário.' },
      { status: 500 }
    )
  }
}

// ===== GET: lista últimos usuários (da tabela pública) ======================

export async function GET() {
  try {
    const list = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, fullName: true, email: true, login: true,
        phone: true, costCenter: true, authId: true,
      },
    })
    return NextResponse.json(list.map(toApi), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('GET /configuracoes/usuarios error', e)
    return NextResponse.json([], { status: 500 })
  }
}
