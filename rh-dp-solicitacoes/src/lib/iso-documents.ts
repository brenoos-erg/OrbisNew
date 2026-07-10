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
      ownerCostCenter: { select: { id: true, code: true, description: true } },
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
      ownerCostCenterId: params.get('ownerCostCenterId') ?? undefined,
      authorUserId: params.get('authorUserId') ?? undefined,
      status: params.get('status') as DocumentVersionStatus | null,
    },
  }
}

export function buildVersionWhere(filters: ReturnType<typeof parseGridParams>['filters']) {
  return {
    status: filters.status ?? undefined,
    document: {
      isActive: true,
      code: filters.code ? { contains: filters.code } : undefined,
      title: filters.title ? { contains: filters.title } : undefined,
      documentTypeId: filters.documentTypeId,
      ownerCostCenterId: filters.ownerCostCenterId,
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
      centroResponsavel:
        row.document.ownerCostCenter
          ? [row.document.ownerCostCenter.code, row.document.ownerCostCenter.description].filter(Boolean).join(' - ')
          : '-',
      elaborador: row.document.author.fullName,
      vencimento: row.expiresAt,
      status: row.status,
      documentId: row.document.id,
      documentType: row.document.documentType.description,
      documentTypeId: row.document.documentType.id,
      ownerDepartmentId: null,
      ownerCostCenterId: row.document.ownerCostCenter?.id ?? null,
      authorUserId: row.document.author.id,
    })),
  }
}
export async function explainPublishedVisibility(code: string, where: Prisma.DocumentVersionWhereInput, totalFound: number) {
  const document = await prisma.isoDocument.findFirst({
    where: { code },
    select: {
      id: true,
      code: true,
      isActive: true,
      versions: { select: { status: true, fileUrl: true, obsoleteAt: true } },
    },
  })

  let reason: string | undefined
  if (!document) reason = 'NOT_FOUND'
  else if (!document.isActive) reason = 'DOCUMENT_INACTIVE'
  else {
    const published = document.versions.filter((version) => version.status === DocumentVersionStatus.PUBLICADO)
    if (!published.length) {
      if (document.versions.length && document.versions.every((version) => version.status === DocumentVersionStatus.CANCELADO)) reason = 'ONLY_CANCELADO'
      else if (document.versions.length && document.versions.every((version) => version.obsoleteAt)) reason = 'ONLY_OBSOLETE'
      else reason = 'NO_PUBLICADO_VERSION'
    } else if (published.every((version) => !version.fileUrl)) reason = 'MISSING_FILE_URL'
  }

  return { filtersApplied: where, totalFound, documentExists: Boolean(document), appearsInPublishedGrid: Boolean(document && !reason), reason }
}
