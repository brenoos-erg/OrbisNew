import { NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  await requireActiveUser()

  const [documentTypes, departments, authors] = await Promise.all([
    prisma.documentTypeCatalog.findMany({ orderBy: { description: 'asc' }, select: { id: true, description: true } }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
  ])

  return NextResponse.json({ documentTypes, departments, authors })
}