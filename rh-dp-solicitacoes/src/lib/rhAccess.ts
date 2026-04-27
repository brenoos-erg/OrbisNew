import { prisma } from '@/lib/prisma'

type RhDepartmentLike = {
  code?: string | null
  sigla?: string | null
  name?: string | null
}

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function isRhDepartment(department: RhDepartmentLike | null | undefined) {
  const code = normalize(department?.code)
  const sigla = normalize(department?.sigla)
  const name = normalize(department?.name)

  return code === '17' || sigla.includes('rh') || name.includes('recursos humanos')
}

export async function resolveRhDepartmentIds() {
  const rows = await prisma.department.findMany({
    where: {
      OR: [{ code: '17' }, { sigla: { contains: 'RH' } }, { name: { contains: 'Recursos Humanos' } }],
    },
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

export async function userHasRhAccess(user: { id: string; role?: string | null; departmentId?: string | null }) {
  if (user.role === 'RH') return true

  const rhDepartmentIds = await resolveRhDepartmentIds()
  if (rhDepartmentIds.length === 0) return false

  if (user.departmentId && rhDepartmentIds.includes(user.departmentId)) {
    return true
  }

  const departmentLink = await prisma.userDepartment.findFirst({
    where: {
      userId: user.id,
      departmentId: { in: rhDepartmentIds },
    },
    select: { departmentId: true },
  })

  return Boolean(departmentLink)
}
