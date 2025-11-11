// src/app/api/configuracoes/usuarios/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Admin client – SÓ NO SERVIDOR
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** GET: lista usuários do Supabase Auth e enriquece com dados do Prisma (retorna ARRAY) */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (error) {
      console.error('listUsers error', error)
      return NextResponse.json({ error: 'Falha ao listar usuários do Auth.' }, { status: 500 })
    }

    const authUsers = data?.users ?? []
    const emails = authUsers.map(u => u.email).filter((e): e is string => !!e)

    // busca correspondências no Prisma (para login/phone/costCenter)
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
        id: fromDb?.id ?? '',             // id do Prisma (se existir)
        fullName,
        email: u.email ?? '',
        login,
        phone: fromDb?.phone ?? null,
        costCenter: fromDb?.costCenter ?? null,
      }
    })

    return NextResponse.json(rows)
  } catch (e: any) {
    console.error('GET /api/configuracoes/usuarios error', e)
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST: cria usuário NO AUTH e no PRISMA
 * Body: { fullName, email, login, phone?, costCenter?, password?, firstAccess? }
 * - firstAccess = true  → envia convite (usuário define a senha no link)
 * - firstAccess = false → cria com a senha informada (email confirmado)
 */
export async function POST(req: Request) {
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

    const user_metadata = { fullName, login, phone, costCenter }
    let authUserId: string | null = null

    if (firstAccess) {
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: user_metadata,
        // redirectTo: 'http://localhost:3000/login', // opcional
      })
      if (error) {
        console.error('inviteUserByEmail error', error)
        return NextResponse.json({ error: error.message || 'Falha ao convidar usuário.' }, { status: 500 })
      }
      authUserId = data?.user?.id ?? null
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
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
    console.error('POST /api/configuracoes/usuarios error', e)
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Email ou login já cadastrado.' }, { status: 409 })
    }
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 })
  }
}
