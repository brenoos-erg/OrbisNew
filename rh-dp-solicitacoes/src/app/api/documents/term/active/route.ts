import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()
  const term = await prisma.documentResponsibilityTerm.findFirst({
    where: { active: true },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(term)
}