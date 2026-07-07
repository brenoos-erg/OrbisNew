import { NextResponse } from 'next/server'
import { Action, ModuleLevel, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { assertCanFeature } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const level = normalizeSstLevel(levels)

    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    await assertCanFeature(me.id, MODULE_KEYS.SST, FEATURE_KEYS.SST.PLANO_DE_ACAO, Action.VIEW)

    const users = await prisma.user.findMany({
      where: { status: UserStatus.ATIVO },
      orderBy: { fullName: 'asc' },
      take: 500,
      select: {
        id: true,
        fullName: true,
        email: true,
        department: { select: { name: true } },
      },
    })

    return NextResponse.json({ users: users.map((user) => ({ ...user, department: user.department?.name ?? null })) })
  } catch (error) {
    console.error('GET /api/sst/plano-de-acao/responsaveis error', error)
    return NextResponse.json(
      { error: 'Erro ao listar responsáveis do plano de ação.', detail: devErrorDetail(error) },
      { status: 500 },
    )
  }
}
