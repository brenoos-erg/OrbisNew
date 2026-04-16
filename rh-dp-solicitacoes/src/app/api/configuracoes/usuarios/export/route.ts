export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { Action } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { assertCanFeature } from '@/lib/permissions'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'

export async function GET() {
  const me = await requireActiveUser()
  await assertCanFeature(me.id, MODULE_KEYS.CONFIGURACOES, FEATURE_KEYS.CONFIGURACOES.USUARIOS, Action.VIEW)

  const users = await prisma.user.findMany({
    orderBy: { fullName: 'asc' },
    include: {
      department: { select: { name: true } },
      costCenter: { select: { description: true, code: true, externalCode: true } },
      position: { select: { name: true } },
    },
  })

  const header = [
    'Nome completo',
    'Login',
    'E-mail',
    'Departamento',
    'Centro de custo',
    'Cargo',
    'Perfil',
    'Status',
    'Data de criação',
  ]

  const lines = users.map((user) => [
    user.fullName,
    user.login ?? '',
    user.email,
    user.department?.name ?? '',
    user.costCenter ? `${user.costCenter.externalCode ?? user.costCenter.code ?? ''} - ${user.costCenter.description}` : '',
    user.position?.name ?? '',
    user.role,
    user.status,
    user.createdAt.toISOString(),
  ])

  const csv = [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';'))
    .join('\n')

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
