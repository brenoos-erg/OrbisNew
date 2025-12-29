import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel, UserStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { withModuleLevel } from '@/lib/access'
import { ensureDefaultModuleAccess } from '@/lib/defaultModuleAccess'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

function normalizePage(value: string | null, defaultValue: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed < 1) return defaultValue
  return parsed
}

function normalizePageSize(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE
  return Math.min(parsed, MAX_PAGE_SIZE)
}

type OrphanRecord = {
  auth_id: string
  email: string | null
  created_at: Date
  last_sign_in_at: Date | null
  raw_user_meta_data: any
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

async function fetchOrphans(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize

  const data = await prisma.$queryRaw<OrphanRecord[]>`\
    SELECT\
      au.id AS auth_id,\
      au.email,\
      au.raw_user_meta_data,\
      au.created_at,\
      au.last_sign_in_at\
    FROM auth.users au\
    LEFT JOIN "User" u ON u."authId" = au.id\
    WHERE u.id IS NULL\
    ORDER BY au.created_at DESC\
    LIMIT ${pageSize} OFFSET ${offset}\
  `

  return data
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
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))

  return words.join(' ') || 'Usuário'
}

async function generateLogin(baseEmail: string) {
  const sanitized = baseEmail
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '') || 'usuario'

  let candidate = sanitized
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.user.findUnique({ where: { login: candidate } })
    if (!exists) return candidate
    candidate = `${sanitized}${i + 1}`
  }

  return `${sanitized}-${Date.now()}`
}

async function reconcileUser(orphan: OrphanRecord) {
  const email = orphan.email?.toLowerCase()
  if (!email) {
    return { skipped: true, reason: 'Usuário sem email no Auth.' as const }
  }

  const fullName = deriveFullName(email, orphan.raw_user_meta_data)
  const login = await generateLogin(email)

  const existingByEmail = await prisma.user.findUnique({ where: { email } })

  if (existingByEmail) {
    const updated = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        authId: orphan.auth_id,
        email,
        fullName: existingByEmail.fullName || fullName,
        login: existingByEmail.login || login,
        status: existingByEmail.status || UserStatus.ATIVO,
      },
    })

    await ensureDefaultModuleAccess(updated.id)

    return { skipped: false, reason: null }
  }

  const createdOrUpdated = await prisma.user.upsert({
    where: { authId: orphan.auth_id },
    update: {
      email,
      fullName,
      login,
      status: UserStatus.ATIVO,
    },
    create: {
      authId: orphan.auth_id,
      email,
      fullName,
      login,
      status: UserStatus.ATIVO,
    },
  })
  await ensureDefaultModuleAccess(createdOrUpdated.id)

  return { skipped: false, reason: null }
}

export const GET = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_3,
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const page = normalizePage(searchParams.get('page'), 1)
    const pageSize = normalizePageSize(searchParams.get('pageSize'))

    const [total, data] = await Promise.all([
      countOrphans(),
      fetchOrphans(page, pageSize),
    ])

    return NextResponse.json({
      page,
      pageSize,
      total,
      items: data,
    })
  },
)

export const POST = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_3,
  async (req: NextRequest) => {
    const body = await req.json().catch(() => ({}))
    const action = body?.action ?? 'fix'
    const limit = Math.max(1, Math.min(Number(body?.limit) || 100, 1000))

    if (action !== 'fix') {
      return NextResponse.json(
        { error: 'Ação inválida. Use action="fix".' },
        { status: 400 },
      )
    }

    const orphans = await prisma.$queryRaw<OrphanRecord[]>`\
      SELECT\
        au.id AS auth_id,\
        au.email,\
        au.raw_user_meta_data,\
        au.created_at,\
        au.last_sign_in_at\
      FROM auth.users au\
      LEFT JOIN "User" u ON u."authId" = au.id\
      WHERE u.id IS NULL\
      ORDER BY au.created_at ASC\
      LIMIT ${limit}\
    `

    let fixedCount = 0
    let skippedCount = 0
    const errors: { authId: string; message: string }[] = []

    for (const orphan of orphans) {
      try {
        const result = await reconcileUser(orphan)
        if (result.skipped) {
          skippedCount += 1
        } else {
          fixedCount += 1
        }
      } catch (err: any) {
        console.error('Erro ao reconciliar usuário', orphan.auth_id, err)
        errors.push({
          authId: orphan.auth_id,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        })
      }
    }

    return NextResponse.json({
      action: 'fix',
      processed: orphans.length,
      fixedCount,
      skippedCount,
      errors,
    })
  },
)

async function fetchDeletionCandidates() {
  return prisma.$queryRaw<OrphanRecord[]>`\
    SELECT\
      au.id AS auth_id,\
      au.email,\
      au.raw_user_meta_data,\
      au.created_at,\
      au.last_sign_in_at\
    FROM auth.users au\
    LEFT JOIN "User" u ON u."authId" = au.id\
    WHERE u.id IS NULL\
      AND au.email ILIKE '%@ergengenharia.com.br'\
      AND au.last_sign_in_at IS NULL\
      AND au.created_at < (NOW() - INTERVAL '7 days')\
    ORDER BY au.created_at ASC\
  `
}

export const DELETE = withModuleLevel(
  'configuracoes',
  ModuleLevel.NIVEL_3,
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const dryRun = searchParams.get('dryRun') !== 'false'

    const candidates = await fetchDeletionCandidates()

    if (dryRun) {
      return NextResponse.json({
        action: 'delete',
        dryRun: true,
        candidates,
      })
    }

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        {
          error:
            'Credenciais de admin do Supabase ausentes; não é possível deletar usuários.',
        },
        { status: 500 },
      )
    }

    const errors: { authId: string; message: string }[] = []
    let deletedCount = 0

    for (const candidate of candidates) {
      const { error } = await admin.auth.admin.deleteUser(candidate.auth_id)
      if (error) {
        console.error('Erro ao deletar usuário do Auth', candidate.auth_id, error)
        errors.push({ authId: candidate.auth_id, message: error.message })
        continue
      }
      deletedCount += 1
    }

    return NextResponse.json({
      action: 'delete',
      dryRun: false,
      deletedCount,
      attempted: candidates.length,
      errors,
    })
  },
)