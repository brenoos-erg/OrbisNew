import { DocumentVersionStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const ISO_GRID_SELECT = {
  id: true,
  revisionNumber: true,
  status: true,
  publishedAt: true,
  expiresAt: true,
  document: {
    select: {
      id: true,
      code: true,
      title: true,
      ownerDepartment: { select: { id: true, name: true } },
      author: { select: { id: true, fullName: true } },
      documentType: { select: { id: true, code: true, description: true } },
    },
  },
} satisfies Prisma.DocumentVersionSelect

export type GridSortBy = 'publishedAt' | 'code' | 'revisionNumber' | 'expiresAt'

export function parseGridParams(params: URLSearchParams) {
  const page = Number(params.get('page') ?? '1') || 1
  const pageSize = Number(params.get('pageSize') ?? '20') || 20
  const sortBy = (params.get('sortBy') ?? 'publishedAt') as GridSortBy
  const sortOrder: Prisma.SortOrder = (params.get('sortOrder') ?? 'desc') === 'asc' ? 'asc' : 'desc'

  return {
    page: Math.max(page, 1),
    pageSize: Math.min(Math.max(pageSize, 1), 100),
    sortBy,
    sortOrder,
    filters: {
      code: params.get('code') ?? undefined,
      title: params.get('title') ?? undefined,
      documentTypeId: params.get('documentTypeId') ?? undefined,
      ownerDepartmentId: params.get('ownerDepartmentId') ?? undefined,
      authorUserId: params.get('authorUserId') ?? undefined,
      status: params.get('status') as DocumentVersionStatus | null,
    },
  }
}

export function buildVersionWhere(filters: ReturnType<typeof parseGridParams>['filters']) {
  return {
    status: filters.status ?? undefined,
    document: {
      code: filters.code ? { contains: filters.code } : undefined,
      title: filters.title ? { contains: filters.title } : undefined,
      documentTypeId: filters.documentTypeId,
      ownerDepartmentId: filters.ownerDepartmentId,
      authorUserId: filters.authorUserId,
    },
  } satisfies Prisma.DocumentVersionWhereInput
}

function buildOrderBy(sortBy: GridSortBy, sortOrder: Prisma.SortOrder): Prisma.DocumentVersionOrderByWithRelationInput[] {
  if (sortBy === 'code') {
    return [{ document: { code: sortOrder } }, { createdAt: 'desc' }]
  }

  if (sortBy === 'revisionNumber') {
    return [{ revisionNumber: sortOrder }, { createdAt: 'desc' }]
  }

  if (sortBy === 'expiresAt') {
    return [{ expiresAt: sortOrder }, { createdAt: 'desc' }]
  }

  return [{ publishedAt: sortOrder }, { createdAt: 'desc' }]
}

export async function fetchGrid(
  where: Prisma.DocumentVersionWhereInput,
  page: number,
  pageSize: number,
  sortBy: GridSortBy,
  sortOrder: Prisma.SortOrder,
) {
  const [total, rows] = await Promise.all([
    prisma.documentVersion.count({ where }),
    prisma.documentVersion.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: ISO_GRID_SELECT,
    }),
  ])

  return {
    total,
    page,
    pageSize,
    items: rows.map((row) => ({
      versionId: row.id,
      dataPublicacao: row.publishedAt,
      codigo: row.document.code,
      nrRevisao: row.revisionNumber,
      titulo: row.document.title,
      centroResponsavel: row.document.ownerDepartment.name,
      elaborador: row.document.author.fullName,
      vencimento: row.expiresAt,
      status: row.status,
      documentId: row.document.id,
      documentType: row.document.documentType.description,
      documentTypeId: row.document.documentType.id,
      ownerDepartmentId: row.document.ownerDepartment.id,
      authorUserId: row.document.author.id,
    })),
  }
}