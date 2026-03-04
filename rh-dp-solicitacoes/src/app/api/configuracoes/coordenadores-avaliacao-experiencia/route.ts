import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { assertUserMinLevel } from '@/lib/access'
import { ModuleLevel, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_EVALUATOR_GROUP_NAME } from '@/lib/experienceEvaluation'

type PutBody = {
  userIds?: unknown
}

export async function GET() {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const [users, group] = await Promise.all([
      prisma.user.findMany({
        where: { status: UserStatus.ATIVO },
        select: { id: true, fullName: true, email: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.approverGroup.findFirst({
        where: { name: EXPERIENCE_EVALUATOR_GROUP_NAME },
        select: { members: { select: { userId: true } } },
      }),
    ])

    return NextResponse.json({
      users,
      selectedUserIds: group?.members.map((member) => member.userId) ?? [],
    })
  } catch (error) {
    console.error('GET /api/configuracoes/coordenadores-avaliacao-experiencia error', error)
    return NextResponse.json(
      { error: 'Erro ao carregar coordenadores de avaliação de experiência.' },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await requireActiveUser()
    await assertUserMinLevel(me.id, 'configuracoes', ModuleLevel.NIVEL_3)

    const body = (await req.json().catch(() => ({}))) as PutBody
    const userIds = Array.isArray(body.userIds)
      ? Array.from(
          new Set(
            body.userIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
          ),
        )
      : []

    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, status: UserStatus.ATIVO },
      select: { id: true },
    })
    const validUserIds = users.map((user) => user.id)

    let group = await prisma.approverGroup.findFirst({
      where: { name: EXPERIENCE_EVALUATOR_GROUP_NAME, departmentId: null },
      select: { id: true },
    })

    if (!group) {
      group = await prisma.approverGroup.create({
        data: { name: EXPERIENCE_EVALUATOR_GROUP_NAME },
        select: { id: true },
      })
    }

    const groupId = group.id

    await prisma.$transaction([
      prisma.approverGroupMember.deleteMany({ where: { groupId } }),
      ...(validUserIds.length
        ? [
            prisma.approverGroupMember.createMany({
              data: validUserIds.map((userId) => ({ groupId, userId })),
            }),
          ]
        : []),
    ])

    return NextResponse.json({ ok: true, selectedUserIds: validUserIds })
  } catch (error) {
    console.error('PUT /api/configuracoes/coordenadores-avaliacao-experiencia error', error)
    return NextResponse.json(
      { error: 'Erro ao salvar coordenadores de avaliação de experiência.' },
      { status: 500 },
    )
  }
}