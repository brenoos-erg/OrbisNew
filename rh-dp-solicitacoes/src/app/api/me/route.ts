export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureUserDepartmentLink } from '@/lib/userDepartments'
import { getUserModuleLevels } from '@/lib/moduleAccess'
import { requireActiveUser } from '@/lib/auth'

export async function GET() {
  const me = await requireActiveUser()
  const dbUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      id: true, email: true, fullName: true, login: true, phone: true, role: true,
      positionId: true, position: { select: { name: true } },
      departmentId: true, department: { select: { name: true, code: true } },
      costCenterId: true, costCenter: { select: { code: true, description: true } },
      leaderId: true, leader: { select: { fullName: true } },
    },
  })
  if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  const moduleLevels = await getUserModuleLevels(dbUser.id)
  const departmentsLinks = await prisma.userDepartment.findMany({ where: { userId: dbUser.id }, select: { department: { select: { id: true, name: true, code: true } } } })
  return NextResponse.json({
    id: dbUser.id, email: dbUser.email, fullName: dbUser.fullName, login: dbUser.login, phone: dbUser.phone, role: dbUser.role,
    positionId: dbUser.positionId, positionName: dbUser.position?.name ?? null,
    departmentId: dbUser.departmentId, departmentName: dbUser.department?.name ?? null, departmentCode: dbUser.department?.code ?? null,
    departments: departmentsLinks.map((link) => ({ id: link.department.id, name: link.department.name, code: link.department.code })),
    costCenterId: dbUser.costCenterId, costCenterName: dbUser.costCenter ? `${dbUser.costCenter.code ? dbUser.costCenter.code + ' - ' : ''}${dbUser.costCenter.description}` : null,
    leaderId: dbUser.leaderId, leaderName: dbUser.leader?.fullName ?? null, moduleLevels,
  })
}

export async function PATCH(req: Request) {
  const me = await requireActiveUser()
  const body = await req.json()
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: {
      fullName: body.fullName ?? undefined,
      login: body.login ?? undefined,
      phone: body.phone ?? undefined,
      positionId: body.positionId ?? undefined,
      departmentId: body.departmentId ?? undefined,
      costCenterId: body.costCenterId ?? undefined,
      leaderId: body.leaderId ?? undefined,
      avatarUrl: body.avatarUrl ?? undefined,
    },
    select: { id: true, fullName: true, login: true, phone: true, positionId: true, departmentId: true, costCenterId: true, leaderId: true },
   })
  if (body.departmentId) await ensureUserDepartmentLink(updated.id, body.departmentId)
  return NextResponse.json(updated)
}