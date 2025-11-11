// src/app/api/configuracoes/usuarios/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// -------- sessão (leitura CORRETA dos cookies da request)
async function requireSession() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

// -------- admin client (Service Role) só no servidor
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

/** GET: lista usuários do Auth e enriquece com dados do Prisma (retorna ARRAY) */
export async function GET() {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const admin = getSupabaseAdmin()
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (error) {
      console.error('listUsers error', error)
      return NextResponse.json({ error: 'Falha ao listar usuários do Auth.' }, { status: 500 })
    }

    const authUsers = data?.users ?? []
    const emails = authUsers.map(u => u.email).filter((e): e is string => !!e)

    // pega correspondências no Prisma (login/phone/costCenter)
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, fullName: true, login: true, phone: true, costCenter: true },
    })
    const byEmail = new Map<string, (typeof existing)[number]>(
      existing.map((u: (typeof existing)[number]) => [u.email, u])
    )

    const rows = authUsers.map(u => {
      const meta = (u.user_metadata || {}) as Record<string, any>
      const fromDb = u.email ? byEmail.get(u.email) : undefined

      const fullName = fromDb?.fullName
        ? String(fromDb.fullName)
        : String(meta.fullName ?? meta.name ?? u.email ?? 'Usuário')

      const login = fromDb?.login
        ? String(fromDb.login)
        : String(meta.login ?? (u.email ? u.email.split('@')[0] : ''))

      return {
        id: fromDb?.id ?? '', // id do Prisma (se existir)
        fullName,
        email: u.email ?? '',
        login,
        phone: fromDb?.phone ?? null,
        costCenter: fromDb?.costCenter ?? null,
      }
    })

    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /configuracoes/usuarios error', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST: cria usuário NO AUTH e no PRISMA
 * Body: { fullName, email, login, phone?, costCenter?, password?, firstAccess? }
 * - firstAccess = true  → cria com senha TEMPORÁRIA + mustChangePassword
 * - firstAccess = false → cria com a senha informada (email confirmado)
 */
export async function POST(req: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({}))

    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const login = String(body.login ?? '').trim().toLowerCase()
    const phone = body.phone ? String(body.phone).trim() : null
    const costCenter = body.costCenter ? String(body.costCenter).trim() : null
    const password = body.password ? String(body.password) : ''
    const firstAccess = Boolean(body.firstAccess)

    if (!fullName || !email || !login) {
      return NextResponse.json({ error: 'fullName, email e login são obrigatórios.' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const user_metadata = { fullName, login, phone, costCenter }
    let authUserId: string | null = null

    if (firstAccess) {
      // cria com senha TEMPORÁRIA e marca "mustChangePassword"
      const tempPassword =
        password && String(password).trim().length >= 6
          ? String(password).trim()
          : Math.random().toString(36).slice(2, 10)

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { ...user_metadata, mustChangePassword: true },
      })
      if (error) {
        console.error('createUser (firstAccess) error', error)
        return NextResponse.json({ error: error.message || 'Falha ao criar usuário.' }, { status: 500 })
      }
      authUserId = data.user?.id ?? null
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata,
      })
      if (error) {
        console.error('createUser error', error)
        return NextResponse.json({ error: error.message || 'Falha ao criar usuário no Auth.' }, { status: 500 })
      }
      authUserId = data.user?.id ?? null
    }

    // espelha no Prisma (upsert por email)
    const created = await prisma.user.upsert({
      where: { email },
      update: { fullName, login, phone, costCenter, authId: authUserId ?? undefined },
      create: { email, fullName, login, phone, costCenter, authId: authUserId ?? undefined },
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenter: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    console.error('POST /configuracoes/usuarios error', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email ou login já cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
