import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MODULE_KEYS } from '@/lib/featureKeys'

export async function findLevel3SolicitacoesApprover(departmentCode?: string) {
  const approverAccess = await prisma.userModuleAccess.findFirst({
    where: {
      level: ModuleLevel.NIVEL_3,
      module: {
        key: MODULE_KEYS.SOLICITACOES,
      },
      user: {
        status: 'ATIVO',
        ...(departmentCode
          ? {
              OR: [
                { department: { code: departmentCode } },
                {
                  userDepartments: {
                    some: {
                      department: { code: departmentCode },
                    },
                  },
                },
              ],
            }
          : {}),
       },
    },
    orderBy: {
      user: {
        fullName: 'asc',
      },
    },
    include: {
      user: true,
    },
  })

  if (approverAccess?.user) return approverAccess.user

  if (departmentCode) {
    return null
  }

  return prisma.user.findFirst({
    where: { status: 'ATIVO' },
    orderBy: { fullName: 'asc' },
  })
}