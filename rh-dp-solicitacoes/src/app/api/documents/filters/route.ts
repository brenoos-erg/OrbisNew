import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()

  const [documentTypes, authors, responsibleCostCenters] = await Promise.all([
    prisma.documentTypeCatalog.findMany({ orderBy: { description: 'asc' }, select: { id: true, description: true } }),
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
    prisma.costCenter.findMany({
      orderBy: [{ code: 'asc' }, { description: 'asc' }],
      select: { id: true, code: true, description: true },
    }),
  ])

  return NextResponse.json({ documentTypes, authors, responsibleCostCenters })
}