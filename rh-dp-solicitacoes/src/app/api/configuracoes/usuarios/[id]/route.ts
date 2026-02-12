export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { Action } from '@prisma/client'
import { hashPassword } from '@/lib/auth-local'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireActiveUser()
  await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.VIEW)
  const u = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, fullName: true, email: true, login: true, phone: true, costCenterId: true, costCenter: { select: { description: true } } } })
  if (!u) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  return NextResponse.json({ ...u, login: u.login ?? '', phone: u.phone ?? '', costCenterName: u.costCenter?.description ?? null })

}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const me = await requireActiveUser()
    await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.UPDATE)
    const body = await req.json()
    const password = (body.password ?? '').trim()
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        fullName: body.fullName?.trim() || undefined,
        email: body.email?.trim().toLowerCase() || undefined,
        login: body.login?.trim().toLowerCase() || undefined,
        phone: body.phone?.trim() || undefined,
        costCenterId: body.costCenterId?.trim() || undefined,
        ...(password ? { passwordHash: await hashPassword(password), mustChangePassword: false } : {}),
      },
      select: { id: true, fullName: true, email: true, login: true, phone: true, costCenterId: true },
    })
    return NextResponse.json({ ...updated, login: updated.login ?? '', phone: updated.phone ?? '' })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Violação de UNIQUE (email/login).' }, { status: 409 })
    return NextResponse.json({ error: 'Erro ao atualizar usuário.' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireActiveUser()
  await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.DELETE)
  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
