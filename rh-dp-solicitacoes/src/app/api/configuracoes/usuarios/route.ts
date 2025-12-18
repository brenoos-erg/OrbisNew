// src/app/api/configuracoes/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
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

// Busca usuário no Auth por email (compatível com versões antigas)
async function findAuthUserIdByEmail(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  email: string,
) {
  const target = email.trim().toLowerCase()

  let page = 1
  const perPage = 1000

  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    const found = (data?.users ?? []).find(
      (u) => (u.email ?? '').toLowerCase() === target,
    )
    if (found?.id) return found.id

    if (!data?.users || data.users.length < perPage) break
    page++
  }

  return null
}

// === GET: listar usuários ===
export async function GET() {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      fullName: true,
      email: true,
      login: true,
      phone: true,
      costCenterId: true,
      costCenter: {
        select: {
          description: true,
          code: true,
          externalCode: true,
        },
      },
    },
  })

  const list = rows.map((r) => {
    const cc = r.costCenter
    const ccCode = cc?.externalCode || cc?.code || ''
    const costCenterName = cc
      ? ccCode
        ? `${ccCode} - ${cc.description}`
        : cc.description
      : null

    return {
      id: r.id,
      fullName: r.fullName,
      email: r.email,
      login: r.login ?? '',
      phone: r.phone ?? '',
      costCenterId: r.costCenterId ?? null,
      costCenterName,
    }
  })

  return NextResponse.json(list)
}

// === POST: criar usuário (Auth primeiro + Prisma upsert) ===
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '').trim() || null
    const costCenterId = body.costCenterId || null
    const rawPassword = (body.password ?? '').trim()
    const firstAccess = !!body.firstAccess

    if (!fullName || !email || !login) {
      return NextResponse.json(
        { error: 'Nome, e-mail e login são obrigatórios.' },
        { status: 400 },
      )
    }

    const admin = getSupabaseAdmin()

    // 1) AUTH: acha por email; se não existir, cria
    let authId: string | null = null

    if (admin) {
      authId = await findAuthUserIdByEmail(admin, email)

      if (!authId) {
        const effectivePassword = rawPassword || `${login}@123`

        const { data: authData, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            password: effectivePassword,
            email_confirm: true,
            user_metadata: {
              fullName,
              login,
              phone,
              costCenterId,
              mustChangePassword: firstAccess,
            },
          })

        if (createErr) {
          return NextResponse.json(
            { error: 'Falha ao criar no Auth: ' + createErr.message },
            { status: 500 },
          )
        }

        authId = authData?.user?.id ?? null
      }
    }

    // Se não tem admin, não dá pra criar/atualizar Auth -> retorna erro claro
    if (!admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY ausente. Não é possível criar usuário no Auth.' },
        { status: 500 },
      )
    }

    if (!authId) {
      return NextResponse.json(
        { error: 'Não foi possível obter o authId do usuário.' },
        { status: 500 },
      )
    }

    // 2) PRISMA: upsert por email (não delete nunca)
    const appUser = await prisma.user.upsert({
      where: { email },
      create: {
        fullName,
        email,
        login,
        phone,
        costCenterId,
        authId: authId as any,
        status: 'ATIVO',
        role: 'COLABORADOR',
      },
      update: {
        fullName,
        login,
        phone,
        costCenterId,
        authId: authId as any,
        status: 'ATIVO',
      },
      select: { id: true, fullName: true, email: true, login: true },
    })

    // 3) Vincula UserCostCenter (N:N) com upsert
    if (costCenterId) {
      await prisma.userCostCenter.upsert({
        where: {
          userId_costCenterId: { userId: appUser.id, costCenterId },
        },
        create: { userId: appUser.id, costCenterId },
        update: {},
      })
    }

    // 4) NIVEL_1 nos módulos (ajuste o key se necessário)
    // Se no seu banco for 'solicitacoes' (minúsculo), troque aqui.
    const modules = await prisma.module.findMany({
      where: { key: 'SOLICITACOES' },
      select: { id: true },
    })

    if (modules.length > 0) {
      await prisma.userModuleAccess.createMany({
        data: modules.map((m) => ({
          userId: appUser.id,
          moduleId: m.id,
          level: 'NIVEL_1',
        })),
        skipDuplicates: true,
      })
    }

    return NextResponse.json(appUser, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'E-mail ou login já cadastrado.' },
        { status: 409 },
      )
    }

    console.error('POST /api/configuracoes/usuarios error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao criar usuário.' },
      { status: 500 },
    )
  }
}
