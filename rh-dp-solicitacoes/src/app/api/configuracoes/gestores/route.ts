import { NextRequest, NextResponse } from 'next/server'
import { GroupRole } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const GESTORES_GROUP = 'GESTORES_PLANO_ACAO_AVULSO'

async function ensureGroup() {
  const existing = await prisma.accessGroup.findUnique({ where: { name: GESTORES_GROUP } })
  if (existing) return existing
  return prisma.accessGroup.create({ data: { name: GESTORES_GROUP, notes: 'Gestores responsáveis por planos de ação avulsos.' } })
}

export async function GET() {
  await requireActiveUser()
  const group = await ensureGroup()
  const [members, users] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId: group.id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.user.findMany({ where: { status: 'ATIVO' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true } }),
  ])

  return NextResponse.json({
    members: members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, user: m.user })),
    users,
  })
}

export async function PUT(req: NextRequest) {
  const me = await requireActiveUser()
  if (me.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores podem alterar gestores.' }, { status: 403 })

  const payload = await req.json().catch(() => ({} as { userIds?: string[] }))
  const userIds = Array.isArray(payload.userIds) ? payload.userIds.filter((id: unknown): id is string => typeof id === 'string') : []
  const group = await ensureGroup()

  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId: group.id } }),
    ...(userIds.length
      ? [
          prisma.groupMember.createMany({
            data: userIds.map((userId: string) => ({ groupId: group.id, userId, role: GroupRole.MANAGER })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ])

  return NextResponse.json({ ok: true })
}