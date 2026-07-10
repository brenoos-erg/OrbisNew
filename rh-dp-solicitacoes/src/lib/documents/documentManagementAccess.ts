import { ModuleLevel } from '@prisma/client'
import { getUserModuleLevel } from '@/lib/access'
import { MODULE_KEYS } from '@/lib/featureKeys'
import { prisma } from '@/lib/prisma'

type DepartmentLike = { name?: string | null; sigla?: string | null; code?: string | null }
type UserLike = {
  id?: string
  email?: string | null
  login?: string | null
  department?: DepartmentLike | null
  userDepartments?: Array<{ department?: DepartmentLike | null }> | null
  moduleLevel?: ModuleLevel | null
}

export const QUALITY_DOCUMENT_MANAGER_FORBIDDEN_MESSAGE = 'Somente a Qualidade pode cancelar ou excluir documentos publicados.'

function normalize(value?: string | null) {
  return String(value ?? '').trim().toLowerCase()
}

function getAllowlist() {
  return new Set(
    String(process.env.DOCUMENT_QUALITY_MANAGER_EMAILS ?? '')
      .split(',')
      .map((entry) => normalize(entry))
      .filter(Boolean),
  )
}

function isQualityDepartment(department?: DepartmentLike | null) {
  const name = normalize(department?.name)
  const sigla = normalize(department?.sigla)
  const code = normalize(department?.code)
  return name.includes('qualidade') || sigla === 'qua' || sigla === 'sgi' || code === 'qua' || code === 'sgi'
}

export function isQualityDocumentManager(user: UserLike | null | undefined): boolean {
  if (!user || user.moduleLevel !== ModuleLevel.NIVEL_3) return false

  const allowlist = getAllowlist()
  const email = normalize(user.email)
  const login = normalize(user.login)
  if ((email && allowlist.has(email)) || (login && allowlist.has(login))) return true

  const departments = [
    user.department,
    ...(user.userDepartments?.map((link) => link.department) ?? []),
  ]

  return departments.some(isQualityDepartment)
}

export async function requireQualityDocumentManager(userId: string) {
  const [moduleLevel, user] = await Promise.all([
    getUserModuleLevel(userId, MODULE_KEYS.CONTROLE_DOCUMENTOS),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        login: true,
        department: { select: { name: true, sigla: true, code: true } },
        userDepartments: { select: { department: { select: { name: true, sigla: true, code: true } } } },
      },
    }),
  ])

  const canManage = isQualityDocumentManager(user ? { ...user, moduleLevel } : null)
  if (!canManage) {
    return { canManage: false, reason: moduleLevel === ModuleLevel.NIVEL_3 ? 'NOT_QUALITY_DEPARTMENT' : 'MODULE_LEVEL_REQUIRED' }
  }

  return { canManage: true }
}
