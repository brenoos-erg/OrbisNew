import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getNivel3DepartmentIds(userId: string) {
  const access = await prisma.userModuleAccess.findFirst({
    where: { userId, module: { key: 'solicitacoes' } },
    select: { level: true },
  })

  if (access?.level !== ModuleLevel.NIVEL_3) return []

  const ids = new Set<string>()
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } })
  if (user?.departmentId) ids.add(user.departmentId)

  const links = await prisma.userDepartment.findMany({ where: { userId }, select: { departmentId: true } })
  for (const link of links) ids.add(link.departmentId)

  return [...ids]
}

export async function canNivel3ApproveSolicitation(userId: string, solicitationDepartmentId: string | null | undefined) {
  if (!solicitationDepartmentId) return false
  const deptIds = await getNivel3DepartmentIds(userId)
  return deptIds.includes(solicitationDepartmentId)
}