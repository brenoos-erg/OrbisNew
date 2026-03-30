import { ModuleLevel, Prisma } from '@prisma/client'

const DOCUMENT_ALERT_MODULE_KEYS = ['controle-documentos', 'meus-documentos'] as const

export function buildDocumentPublicationRecipientWhere(ownerDepartmentId: string): Prisma.UserWhereInput {
  return {
    status: 'ATIVO',
    OR: [
      { role: 'ADMIN' },
      { departmentId: ownerDepartmentId },
      { userDepartments: { some: { departmentId: ownerDepartmentId } } },
      {
        moduleAccesses: {
          some: {
            level: { in: [ModuleLevel.NIVEL_1, ModuleLevel.NIVEL_2, ModuleLevel.NIVEL_3] },
            module: {
              key: { in: [...DOCUMENT_ALERT_MODULE_KEYS] },
            },
          },
        },
      },
    ],
  }
}