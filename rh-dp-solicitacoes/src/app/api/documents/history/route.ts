import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize') ?? '20') || 20))

  const [total, items] = await Promise.all([
    prisma.documentAuditLog.count(),
    prisma.documentAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        document: { select: { id: true, code: true, title: true } },
        version: { select: { id: true, revisionNumber: true } },
      },
    }),
  ])

  return NextResponse.json({
    total,
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      createdAt: item.createdAt,
      ip: item.ip,
      userAgent: item.userAgent,
      user: item.user,
      document: item.document,
      version: item.version,
    })),
  })
}