export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { performance } from 'node:perf_hooks'
import { prisma } from '@/lib/prisma'
import { ensureDefaultModuleAccess } from '@/lib/defaultModuleAccess'
import { requireActiveUser } from '@/lib/auth'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { Action } from '@prisma/client'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'
import { hashPassword } from '@/lib/auth-local'

export async function GET(req: NextRequest) { /* unchanged list */

  return withRequestMetrics('GET /api/configuracoes/usuarios', async () => {
     const me = await requireActiveUser()
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.VIEW)
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
    const skip = (page - 1) * pageSize
    const search = (searchParams.get('search') ?? '').trim()
    const where = search ? { OR: [{ fullName: { contains: search } }, { email: { contains: search } }, { login: { contains: search } }] } : undefined
    const listStartedAt = performance.now()
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize, select: { id: true, fullName: true, email: true, login: true, phone: true, costCenterId: true, costCenter: { select: { description: true, code: true, externalCode: true } } } }),
      prisma.user.count({ where }),
    ])
    logTiming('prisma.user.list (/api/configuracoes/usuarios)', listStartedAt)
    return NextResponse.json({ items: rows.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, login: r.login ?? '', phone: r.phone ?? '', costCenterId: r.costCenterId ?? null, costCenterName: r.costCenter ? `${r.costCenter.externalCode || r.costCenter.code || ''}${r.costCenter.externalCode || r.costCenter.code ? ' - ' : ''}${r.costCenter.description}` : null })), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  })
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.CREATE)
    const body = await req.json().catch(() => ({}))
    const fullName = (body.fullName ?? '').trim()
    const email = (body.email ?? '').trim().toLowerCase()
    const login = (body.login ?? '').trim().toLowerCase()
    const phone = (body.phone ?? '').trim() || null
    const costCenterId = body.costCenterId || null
    const rawPassword = (body.password ?? '').trim() || `${login || fullName.split(' ')[0] || 'User'}@123`
    const mustChangePassword = !!body.firstAccess
    if (!fullName || !email || !login) return NextResponse.json({ error: 'Nome, e-mail e login são obrigatórios.' }, { status: 400 })

       const appUser = await prisma.user.create({
      data: { fullName, email, login, phone, costCenterId, status: 'ATIVO', role: 'COLABORADOR', passwordHash: await hashPassword(rawPassword), mustChangePassword },
      select: { id: true, fullName: true, email: true, login: true },
    })

    if (costCenterId) await prisma.userCostCenter.upsert({ where: { userId_costCenterId: { userId: appUser.id, costCenterId } }, create: { userId: appUser.id, costCenterId }, update: {} })
    await ensureDefaultModuleAccess(appUser.id)
    return NextResponse.json({ ...appUser, message: 'Usuário local criado com sucesso.' }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'E-mail ou login já cadastrado.' }, { status: 409 })
    return NextResponse.json({ error: e?.message || 'Erro ao criar usuário.' }, { status: 500 })

  }
}
