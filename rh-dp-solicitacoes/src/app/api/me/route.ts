export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { performance } from 'node:perf_hooks'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { prisma } from '@/lib/prisma'
import { ensureUserDepartmentLink } from '@/lib/userDepartments'
import { getUserModuleLevels } from '@/lib/moduleAccess'
import { logTiming, withRequestMetrics } from '@/lib/request-metrics'

// GET /api/me
export async function GET() {
  return withRequestMetrics('GET /api/me', async () => {
    const supabase = createRouteHandlerClient({ cookies })
    const authStartedAt = performance.now()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    logTiming('supabase.auth.getUser (/api/me)', authStartedAt)

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const email = user.email
    const authId = user.id // UUID do Supabase

    if (!email) {
      return NextResponse.json(
        { error: 'Usuário do Supabase sem e-mail.' },
        { status: 400 },
      )
    }

    const userSelect = {
      id: true,
      email: true,
      fullName: true,
      login: true,
      phone: true,
      role: true,
      positionId: true,
      position: { select: { name: true } },
      departmentId: true,
      department: { select: { name: true, code: true } },
      costCenterId: true,
      costCenter: { select: { code: true, description: true } },
      leaderId: true,
      leader: { select: { fullName: true } },
    }

    const lookupStartedAt = performance.now()
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ authId }, { email }],
      },
      select: userSelect,
    })
    logTiming('prisma.user.findFirst (/api/me)', lookupStartedAt)

    if (!dbUser) {
      const createStartedAt = performance.now()
      dbUser = await prisma.user.create({
        data: {
          email,
          fullName:
            (user.user_metadata as any)?.full_name ??
            (user.user_metadata as any)?.name ??
            email,
          login: (user.user_metadata as any)?.login ?? email,
          authId,
        },
        select: userSelect,
      })
      logTiming('prisma.user.create (/api/me)', createStartedAt)
    }

    const levelsStartedAt = performance.now()
    const moduleLevels = await getUserModuleLevels(dbUser.id)
    logTiming('prisma.moduleLevels.load (/api/me)', levelsStartedAt)
     const departmentsLinks = await prisma.userDepartment.findMany({
      where: { userId: dbUser.id },
      select: {
        department: { select: { id: true, name: true, code: true } },
      },
    })


    const responseBody = {
      id: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      login: dbUser.login,
      phone: dbUser.phone,
      role: dbUser.role,

      positionId: dbUser.positionId,
      positionName: dbUser.position?.name ?? null,

      departmentId: dbUser.departmentId,
      departmentName: dbUser.department?.name ?? null,
      departmentCode: dbUser.department?.code ?? null,
      departments: departmentsLinks.map((link) => ({
        id: link.department.id,
        name: link.department.name,
        code: link.department.code,
      })),

      costCenterId: dbUser.costCenterId,
      costCenterName: dbUser.costCenter
        ? `${dbUser.costCenter.code ? dbUser.costCenter.code + ' - ' : ''}${
            dbUser.costCenter.description
          }`
        : null,

      leaderId: dbUser.leaderId,
      leaderName: dbUser.leader?.fullName ?? null,
      moduleLevels,
    }

    return NextResponse.json(responseBody, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    })
  })
}

// PATCH /api/me (para tela de perfil, se você quiser manter)
export async function PATCH(req: Request) {
  return withRequestMetrics('PATCH /api/me', async () => {
    const supabase = createRouteHandlerClient({ cookies })
    const authStartedAt = performance.now()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    logTiming('supabase.auth.getUser (/api/me PATCH)', authStartedAt)

    if (error || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const email = user.email
    const authId = user.id

    if (!email) {
      return NextResponse.json(
        { error: 'Usuário do Supabase sem e-mail.' },
        { status: 400 },
      )
    }

    const body = await req.json()

    const updated = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        authId,
        fullName: body.fullName ?? '',
        login: body.login ?? email,
        phone: body.phone ?? null,
        positionId: body.positionId ?? null,
        departmentId: body.departmentId ?? null,
        costCenterId: body.costCenterId ?? null,
        leaderId: body.leaderId ?? null,
      },
      update: {
        fullName: body.fullName ?? undefined,
        login: body.login ?? undefined,
        phone: body.phone ?? undefined,
        positionId: body.positionId ?? undefined,
        departmentId: body.departmentId ?? undefined,
        costCenterId: body.costCenterId ?? undefined,
        leaderId: body.leaderId ?? undefined,
      },
      select: {
        id: true,
        fullName: true,
        login: true,
        phone: true,
        positionId: true,
        departmentId: true,
        costCenterId: true,
        leaderId: true,
      },
    })

    if (body.departmentId) {
      await ensureUserDepartmentLink(updated.id, body.departmentId)
    }

    return NextResponse.json(updated)
  })
}
