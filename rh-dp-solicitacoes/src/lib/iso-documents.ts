import { DocumentVersionStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveSourceFileAccess } from '@/lib/documents/documentSourceAccess'

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

function cleanFilter(value: string | null) {
  const trimmed = String(value ?? '').trim()
  return trimmed || undefined
}

export function normalizeDocumentCodeSearch(value: string) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

export function buildDocumentCodeSearchVariants(value: string) {
  const rawCode = String(value ?? '').trim()
  if (!rawCode) return []

  return Array.from(new Set([
    rawCode,
    rawCode.replace(/\s+/g, '.'),
    rawCode.replace(/\s+/g, ''),
    rawCode.replace(/-/g, '.'),
    rawCode.replace(/[\s-]+/g, '.'),
    rawCode.replace(/[.\s\-/]+/g, ''),
  ].filter(Boolean)))
}

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
      code: cleanFilter(params.get('code')),
      title: cleanFilter(params.get('title')),
      documentTypeId: cleanFilter(params.get('documentTypeId')),
      ownerCostCenterId: cleanFilter(params.get('ownerCostCenterId')),
      authorUserId: cleanFilter(params.get('authorUserId')),
      status: cleanFilter(params.get('status')) as DocumentVersionStatus | undefined | null,
    },
  }
}

export function buildVersionWhere(filters: ReturnType<typeof parseGridParams>['filters'], options?: { omitCode?: boolean }) {
  const rawCode = String(filters.code ?? '').trim()
  const codeVariants = options?.omitCode ? [] : buildDocumentCodeSearchVariants(rawCode)

  return {
    status: filters.status ?? undefined,
    document: {
      isActive: true,
      OR: codeVariants.length ? codeVariants.map((variant) => ({ code: { contains: variant } })) : undefined,
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
  codeSearch?: string,
  fallbackWhere?: Prisma.DocumentVersionWhereInput,
  userId?: string,
) {
  const codeNormalized = normalizeDocumentCodeSearch(codeSearch ?? '')
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

  if (total === 0 && codeNormalized && fallbackWhere) {
    const fallbackRows = await prisma.documentVersion.findMany({
      where: fallbackWhere,
      orderBy: buildOrderBy(sortBy, sortOrder),
      take: 500,
      select: ISO_GRID_SELECT,
    })
    const matchedRows = fallbackRows.filter((row) => normalizeDocumentCodeSearch(row.document.code).includes(codeNormalized))
    const pagedRows = matchedRows.slice((page - 1) * pageSize, page * pageSize)

    return formatGridResult(matchedRows.length, page, pageSize, pagedRows, userId)
  }

  return formatGridResult(total, page, pageSize, rows, userId)
}

async function formatGridResult(total: number, page: number, pageSize: number, rows: Prisma.DocumentVersionGetPayload<{ select: typeof ISO_GRID_SELECT }>[], userId?: string) {
  const items = await Promise.all(rows.map(async (row) => {
    const sourceAccess = userId ? await resolveSourceFileAccess(userId, row.id, 'attachment') : null
    const sourceFileAvailable = Boolean(sourceAccess?.sourceFileAvailable)
    return {
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
      sourceFileAvailable,
      canViewSourceFile: Boolean(sourceAccess?.canViewSourceFile),
      canDownloadSourceFile: Boolean(sourceAccess?.canDownloadSourceFile),
    }
  }))
  return { total, page, pageSize, items }
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
