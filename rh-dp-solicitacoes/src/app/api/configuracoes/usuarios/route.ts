// src/app/api/configuracoes/usuarios/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'

import { ensureDefaultModuleAccess } from '@/lib/defaultModuleAccess'
import { requireActiveUser } from '@/lib/auth'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { Action } from '@prisma/client'

export const dynamic = 'force-dynamic'

// Admin client (Service Role) – só no servidor. Retorna null se não houver credenciais.
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('Supabase admin credentials missing; skipping Auth sync.')
    return null
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
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

    const found = (data?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === target)
    if (found?.id) return found.id

    if (!data?.users || data.users.length < perPage) break
    page++
  }

  return null
}

// === GET: listar usuários ===
export async function GET() {
  try {
    const me = await requireActiveUser()
    await assertCanFeature(
      me.id,
      MODULE_KEYS.CONFIGURACOES,
      FEATURE_KEYS.CONFIGURACOES.USUARIOS,
      Action.VIEW,
    )

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
  } catch (e) {
    if (e instanceof Error && e.message.includes('Acesso negado')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    console.error('GET /api/configuracoes/usuarios error', e)
    return NextResponse.json({ error: 'Erro ao carregar usuários.' }, { status: 500 })
  }
}

// === POST: criar usuário (Auth primeiro + Prisma upsert) ===
export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertCanFeature(
      me.id,
      MODULE_KEYS.CONFIGURACOES,
      FEATURE_KEYS.CONFIGURACOES.USUARIOS,
      Action.CREATE,
    )

    const body = await req.json().catch(() => ({}))

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

    // Se não tem admin, não dá pra criar/atualizar Auth -> retorna erro claro
    if (!admin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY ausente. Não é possível criar usuário no Auth.' },
        { status: 500 },
      )
    }

    // 1) AUTH: tenta criar primeiro; se der erro de email, busca via listUsers
    let authId: string | null = null
    let authStatus: 'created' | 'synced' = 'created'

    const userMetadata = {
      fullName,
      login,
      phone,
      costCenterId,
      mustChangePassword: firstAccess,
    }

    const effectivePassword =
      rawPassword || `${login || fullName.split(' ')[0] || 'User'}@123`

    const { data: authData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: effectivePassword,
      email_confirm: true,
      user_metadata: userMetadata,
    })

    if (createErr) {
      const message = createErr.message?.toLowerCase() ?? ''
      const isEmailConflict =
        message.includes('already exists') ||
        message.includes('already registered') ||
        message.includes('database error checking email') ||
        message.includes('email_exists') ||
        message.includes('email already') ||
        message.includes('email rate limit')

      if (!isEmailConflict) {
        return NextResponse.json(
          { error: 'Falha ao criar no Auth: ' + createErr.message },
          { status: 500 },
        )
      }

      authId = await findAuthUserIdByEmail(admin, email)

      if (!authId) {
        return NextResponse.json(
          { error: 'Falha ao criar no Auth: ' + createErr.message },
          { status: 500 },
        )
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(authId, {
        email,
        user_metadata: userMetadata,
        ...(rawPassword ? { password: rawPassword } : {}),
      })

      if (updateErr) {
        return NextResponse.json(
          {
            error:
              'Usuário já existia no Auth, mas falhou ao sincronizar os dados: ' +
              updateErr.message,
          },
          { status: 500 },
        )
      }

      authStatus = 'synced'
    } else {
      authId = authData?.user?.id ?? null
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
        authId,
        status: 'ATIVO',
        role: 'COLABORADOR',
      },
      update: {
        fullName,
        login,
        phone,
        costCenterId,
        authId,
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

    // 4) Garantir acesso padrão de nível 1 aos módulos básicos (inclui Direito de Recusa)
    await ensureDefaultModuleAccess(appUser.id)

    const responsePayload = {
      ...appUser,
      status: authStatus,
      message:
        authStatus === 'synced'
          ? 'Usuário já existia no Auth; dados sincronizados.'
          : 'Usuário criado no Auth e sincronizado.',
    }

    return NextResponse.json(responsePayload, { status: 201 })
  } catch (e: any) {
    if (e instanceof Error && e.message.includes('Acesso negado')) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }

    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'E-mail ou login já cadastrado.' }, { status: 409 })
    }

    console.error('POST /api/configuracoes/usuarios error', e)
    return NextResponse.json(
      { error: e?.message || 'Erro ao criar usuário.' },
      { status: 500 },
    )
  }
}
