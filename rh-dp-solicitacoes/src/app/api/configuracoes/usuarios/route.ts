import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createUserWithAuth } from '@/lib/users/createUserWithAuth'


export const dynamic = 'force-dynamic'

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

// === POST: criar usuário (Prisma + Supabase Auth) ===
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '') || null
    const costCenterId = (body.costCenterId ?? '') || null
    const rawPassword = (body.password ?? '').trim()
    const firstAccess = !!body.firstAccess

    if (!fullName || !email || !login) {
      return NextResponse.json(
        { error: 'Nome, e-mail e login são obrigatórios.' },
        { status: 400 },
      )
    }

   const created = await createUserWithAuth({
      fullName,
      email,
      login,
      phone,
      costCenterId,
      password: rawPassword,
      firstAccess,
    })


    return NextResponse.json(created, { status: 201 })
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
