import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()

  const [documentTypes, departments, authors, responsibleCostCenters] = await Promise.all([
    prisma.documentTypeCatalog.findMany({ orderBy: { description: 'asc' }, select: { id: true, description: true } }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
    prisma.costCenter.findMany({
      where: { departmentId: { not: null } },
      orderBy: [{ departmentId: 'asc' }, { description: 'asc' }],
      select: { id: true, description: true, departmentId: true },
    }),
  ])

  return NextResponse.json({ documentTypes, departments, authors, responsibleCostCenters })
}