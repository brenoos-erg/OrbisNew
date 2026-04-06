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
      select: { id: true, code: true, externalCode: true, description: true },
    }),
  ])

  const normalizedResponsibleCostCenters = responsibleCostCenters
    .filter((item) => Boolean(item.externalCode?.trim() || item.code?.trim()))
    .map((item) => ({
      id: item.id,
      code: item.code,
      externalCode: item.externalCode,
      description: item.description,
    }))

  return NextResponse.json({ documentTypes, authors, responsibleCostCenters: normalizedResponsibleCostCenters })
}