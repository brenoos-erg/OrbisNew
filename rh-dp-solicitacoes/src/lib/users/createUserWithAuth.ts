import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export type CreateUserParams = {
  fullName: string
  email: string
  login: string
  phone?: string | null
  costCenterId?: string | null
  password?: string | null
  firstAccess?: boolean
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

let cachedModules: { id: string }[] | null = null
async function getDefaultModules() {
  if (!cachedModules) {
    cachedModules = await prisma.module.findMany({
      where: { key: 'solicitacoes' },
      select: { id: true },
    })
  }
  return cachedModules
}

export function toLoginFromName(fullName: string) {
  if (!fullName.trim()) return ''
  const parts = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const first = parts[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return [first, last].filter(Boolean).join('.').replace(/[^a-z.]/g, '')
}

export async function createUserWithAuth(params: CreateUserParams) {
  const fullName = (params.fullName ?? '').trim()
  const email = (params.email ?? '').trim().toLowerCase()
  const login = (params.login ?? '').trim().toLowerCase()
  const phone = (params.phone ?? '') || null
  const costCenterId = (params.costCenterId ?? '') || null
  const password = (params.password ?? '').trim()
  const firstAccess = !!params.firstAccess

  if (!fullName || !email || !login) {
    throw new Error('Nome, e-mail e login são obrigatórios.')
  }

  const created = await prisma.user.create({
    data: { fullName, email, login, phone, costCenterId },
    select: { id: true, fullName: true, email: true, login: true },
  })

  if (costCenterId) {
    await prisma.userCostCenter.create({
      data: { userId: created.id, costCenterId },
    })
  }

  const modules = await getDefaultModules()
  if (modules.length > 0) {
    await prisma.userModuleAccess.createMany({
      data: modules.map((m) => ({
        userId: created.id,
        moduleId: m.id,
        level: 'NIVEL_1',
      })),
      skipDuplicates: true,
    })
  }

  const effectivePassword =
    firstAccess && !password ? `${login || 'usuario'}@123` : password || crypto.randomUUID()

  const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: effectivePassword,
    email_confirm: true,
    user_metadata: {
      fullName,
      login,
      phone,
      costCenterId,
      mustChangePassword: firstAccess,
    },
  })

  if (error) {
    await prisma.user.delete({ where: { id: created.id } })
    throw new Error('Falha ao criar no Auth: ' + error.message)
  }

  if (authData?.user?.id) {
    await prisma.user.update({
      where: { id: created.id },
      data: { authId: authData.user.id as any },
    })
  }

  return {
    id: created.id,
    fullName: created.fullName,
    email: created.email,
    login: created.login ?? '',
    phone,
    costCenterId,
  }
}