import { NextRequest, NextResponse } from 'next/server'
import { DocumentAuditAction, Prisma } from '@prisma/client'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  await requireActiveUser()
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('pageSize') ?? '20') || 20))
  const documentId = req.nextUrl.searchParams.get('documentId')?.trim() ?? ''
  const code = req.nextUrl.searchParams.get('code')?.trim() ?? ''
  const title = req.nextUrl.searchParams.get('title')?.trim() ?? ''
  const user = req.nextUrl.searchParams.get('user')?.trim() ?? ''
  const revision = req.nextUrl.searchParams.get('revision')?.trim() ?? ''
  const action = req.nextUrl.searchParams.get('action')?.trim() ?? ''
  const startDate = req.nextUrl.searchParams.get('startDate')?.trim() ?? ''
  const endDate = req.nextUrl.searchParams.get('endDate')?.trim() ?? ''

  const parsedAction =
    action === 'VIEW' || action === 'DOWNLOAD' || action === 'PRINT'
      ? (action as DocumentAuditAction)
      : undefined

  const where: Prisma.DocumentAuditLogWhereInput = {
    documentId: documentId || undefined,
    action: parsedAction,
    createdAt: startDate || endDate
      ? {
          gte: startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined,
          lte: endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined,
        }
      : undefined,
    document: {
      code: code ? { contains: code } : undefined,
      title: title ? { contains: title } : undefined,
    },
    version: {
      revisionNumber: revision ? Number(revision) || undefined : undefined,
    },
    user: {
      OR: user
        ? [{ fullName: { contains: user } }, { email: { contains: user } }]
        : undefined,
    },
  }

  const documentWhere: Prisma.IsoDocumentWhereInput = {
    code: code ? { contains: code } : undefined,
    title: title ? { contains: title } : undefined,
  }

  const [total, items] = await Promise.all([
    prisma.documentAuditLog.count({ where }),
    prisma.documentAuditLog.findMany({
      where,
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
  const documents = await prisma.isoDocument.findMany({
    where: documentWhere,
    orderBy: [{ code: 'asc' }],
    take: 200,
    select: {
      id: true,
      code: true,
      title: true,
      _count: { select: { downloadLogs: true, printCopies: true } },
    },
  })

  return NextResponse.json({
    total,
    documents: documents.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      totalEvents: doc._count.downloadLogs + doc._count.printCopies,
    })),
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