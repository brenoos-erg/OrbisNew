import { Role, UserStatus } from '@prisma/client'

import { prisma } from './prisma'
import { getSupabaseAdmin } from './supabase-admin'

type OrphanRecord = {
  auth_id: string
  email: string | null
  raw_user_meta_data: any
}

export type ReconcileResult = {
  started_at: string
  finished_at: string
  found_orphans: number
  fixed: number
  skipped: number
  errors: { authId: string; message: string }[]
}

const DEFAULT_BATCH_SIZE = 100
const MAX_ERRORS = 50

function normalizeBatchSize(value?: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE
  return Math.min(parsed, 500)
}

function deriveFullName(email: string, metadata?: any) {
  const metaName = metadata?.fullName || metadata?.full_name
  if (typeof metaName === 'string' && metaName.trim().length > 2) {
    return metaName.trim()
  }

  const localPart = email.split('@')[0]?.replace(/[._]+/g, ' ')
  const words = localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

  return words.join(' ') || 'Usuário'
}

async function generateLogin(baseEmail: string) {
  const sanitized =
    baseEmail
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '') || 'usuario'

  let candidate = sanitized
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.user.findUnique({ where: { login: candidate } })
    if (!exists) return candidate
    candidate = `${sanitized}${i + 1}`
  }

  return `${sanitized}-${Date.now()}`
}

async function countOrphans() {
  const result = await prisma.$queryRaw<{ total: number }[]>`\
    SELECT COUNT(*)::int AS total\
    FROM auth.users au\
    LEFT JOIN "User" u ON u."authId" = au.id\
    WHERE u.id IS NULL\
  `

  return result[0]?.total ?? 0
}

async function fetchOrphans(batchSize: number) {
  return prisma.$queryRaw<OrphanRecord[]>`\
    SELECT\
      au.id AS auth_id,\
      au.email,\
      au.raw_user_meta_data\
    FROM auth.users au\
    LEFT JOIN "User" u ON u."authId" = au.id\
    WHERE u.id IS NULL\
    ORDER BY au.created_at ASC\
    LIMIT ${batchSize}\
  `
}

async function ensureEmail(orphan: OrphanRecord, admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  if (orphan.email) return orphan.email

  const { data, error } = await admin.auth.admin.getUserById(orphan.auth_id)
  if (error) {
    return null
  }

  return data.user?.email ?? null
}

async function reconcileUser(
  orphan: OrphanRecord,
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
): Promise<{ skipped: boolean; reason?: string }> {
  const emailFromSource = orphan.email?.trim().toLowerCase() || (await ensureEmail(orphan, admin))
  const email = emailFromSource?.toLowerCase()

  if (!email) {
    return { skipped: true, reason: 'Usuário sem email no Auth.' }
  }

  const fullName = deriveFullName(email, orphan.raw_user_meta_data)
  const existingByEmail = await prisma.user.findUnique({ where: { email } })

  if (existingByEmail) {
    const nextLogin = existingByEmail.login || (await generateLogin(email))

    await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authId: orphan.auth_id,
        email,
        fullName: existingByEmail.fullName || fullName,
        login: nextLogin,
        status: existingByEmail.status || UserStatus.ATIVO,
        role: existingByEmail.role || Role.COLABORADOR,
      },
    })

    return { skipped: false }
  }

  const login = await generateLogin(email)

  await prisma.user.upsert({
    where: { authId: orphan.auth_id },
    update: {
      authId: orphan.auth_id,
      email,
      fullName,
      login,
      status: UserStatus.ATIVO,
      role: Role.COLABORADOR,
    },
    create: {
      authId: orphan.auth_id,
      email,
      fullName,
      login,
      status: UserStatus.ATIVO,
      role: Role.COLABORADOR,
    },
  })

  return { skipped: false }
}

export async function reconcileAuthUsers(options?: { batchSize?: string | null }) {
  const startedAt = new Date()
  const admin = getSupabaseAdmin()

  if (!admin) {
    throw new Error('Supabase service role (SUPABASE_SERVICE_ROLE_KEY) não configurado.')
  }

  const batchSize = normalizeBatchSize(options?.batchSize)

  let foundOrphans = 0
  let fixed = 0
  let skipped = 0
  const errors: { authId: string; message: string }[] = []

  const totalBefore = await countOrphans()

  for (;;) {
    const orphans = await fetchOrphans(batchSize)
    if (orphans.length === 0) break

    foundOrphans += orphans.length

    for (const orphan of orphans) {
      try {
        const result = await reconcileUser(orphan, admin)
        if (result.skipped) {
          skipped += 1
        } else {
          fixed += 1
        }
      } catch (error) {
        console.error('Erro ao reconciliar usuário', {
          authId: orphan.auth_id,
          error,
        })
        errors.push({
          authId: orphan.auth_id,
          message: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }
  }

  if (foundOrphans === 0) {
    foundOrphans = totalBefore
  }

  const finishedAt = new Date()

  const result: ReconcileResult = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    found_orphans: foundOrphans,
    fixed,
    skipped,
    errors: errors.slice(0, MAX_ERRORS),
  }

  console.log('[reconcile-auth-users]', result)

  return result
}

export function buildReconcileResponse(result: ReconcileResult) {
  return {
    started_at: result.started_at,
    finished_at: result.finished_at,
    found_orphans: result.found_orphans,
    fixed: result.fixed,
    skipped: result.skipped,
    errors: result.errors,
  }
}