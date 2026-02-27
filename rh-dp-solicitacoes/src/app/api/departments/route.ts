export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRequestMetrics } from '@/lib/request-metrics'
import { OFFICIAL_DEPARTMENT_CODES } from '@/lib/officialDepartment'
import { requireActiveUser } from '@/lib/auth'
import { DEFAULT_DEPARTMENT_CODE, ensureDefaultDepartmentExists } from '@/lib/defaultDepartment'

export async function GET() {
  return withRequestMetrics('GET /api/departments', async () => {
    try {
      const me = await requireActiveUser()
      const isAdmin = me.role === 'ADMIN'

      if (isAdmin) {
        await ensureDefaultDepartmentExists()
      }

      const data = await prisma.department.findMany({
        where: {
          OR: [
            { code: { in: OFFICIAL_DEPARTMENT_CODES as string[] } },
            ...(isAdmin ? [{ code: DEFAULT_DEPARTMENT_CODE }] : []),
          ],
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      })

      // O front espera { id, label, description }
      const formatted = data.map((d) => ({
        id: d.id,
        label: d.name,
        description: d.code,
      }))

      return NextResponse.json(formatted, {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=300',
        },
      })
    } catch (e) {
      console.error('Erro ao listar departamentos:', e)
      return NextResponse.json(
        { error: 'Erro ao buscar departamentos' },
        { status: 500 },
      )
    }
  })
}