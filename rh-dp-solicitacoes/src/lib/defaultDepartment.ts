import { prisma } from '@/lib/prisma'

export const DEFAULT_DEPARTMENT_CODE = 'PADRAO'
export const DEFAULT_DEPARTMENT_NAME = 'Padrao'
export const DEFAULT_DEPARTMENT_SIGLA = 'PADRAO'

export function isDefaultDepartmentCode(code?: string | null) {
  return code === DEFAULT_DEPARTMENT_CODE
}

export async function ensureDefaultDepartmentExists() {
  return prisma.department.upsert({
    where: { code: DEFAULT_DEPARTMENT_CODE },
    update: {
      name: DEFAULT_DEPARTMENT_NAME,
      sigla: DEFAULT_DEPARTMENT_SIGLA,
    },
    create: {
      code: DEFAULT_DEPARTMENT_CODE,
      name: DEFAULT_DEPARTMENT_NAME,
      sigla: DEFAULT_DEPARTMENT_SIGLA,
    },
    select: {
      id: true,
      code: true,
      name: true,
    },
  })
}