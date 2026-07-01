import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { buildReceivedFilterText, flattenSearchableText, normalizeSearchText } from './receivedSolicitationsQuery'

const INDEX_INCLUDE = {
  tipo: { select: { id: true, codigo: true, nome: true } },
  department: { select: { id: true, name: true, sigla: true, code: true } },
  costCenter: { select: { id: true, description: true, externalCode: true, code: true, abbreviation: true, observations: true, area: true, groupName: true } },
  solicitante: { select: { id: true, fullName: true, login: true, email: true, department: { select: { name: true, sigla: true, code: true } }, costCenter: { select: { description: true, externalCode: true, code: true, abbreviation: true } } } },
  approver: { select: { id: true, fullName: true, login: true, email: true } },
  assumidaPor: { select: { id: true, fullName: true, login: true, email: true } },
  comentarios: { select: { texto: true, autor: { select: { fullName: true, login: true, email: true } } } },
  anexos: { select: { filename: true, mimeType: true, url: true } },
  timelines: { select: { status: true, message: true, createdAt: true } },
  eventos: { include: { actor: { select: { fullName: true, login: true, email: true } } } },
  solicitacaoSetores: { select: { setor: true, status: true, constaFlag: true } },
} satisfies Prisma.SolicitationInclude

export function normalizeSolicitationSearchText(text: string) {
  return normalizeSearchText(text)
}

export function buildSolicitationSearchIndexText(solicitation: Record<string, unknown>) {
  const payload = solicitation.payload as Record<string, unknown> | null | undefined
  return normalizeSolicitationSearchText(
    [
      buildReceivedFilterText(solicitation),
      flattenSearchableText(solicitation.workflowSnapshotJson),
      flattenSearchableText(solicitation.approvalSnapshotJson),
      flattenSearchableText(solicitation.notificationSnapshotJson),
      flattenSearchableText(payload?.cargoSnapshot),
      flattenSearchableText(payload?.rq063),
      flattenSearchableText(payload?.ferias),
      flattenSearchableText(payload?.epi),
      flattenSearchableText(payload?.uniforme),
      flattenSearchableText(payload?.ti),
    ].filter(Boolean).join(' '),
  )
}

export async function upsertSolicitationSearchIndex(solicitationId: string) {
  const solicitation = await prisma.solicitation.findUnique({ where: { id: solicitationId }, include: INDEX_INCLUDE })
  if (!solicitation) return null
  const searchText = buildSolicitationSearchIndexText(solicitation as unknown as Record<string, unknown>)
  return prisma.solicitationSearchIndex.upsert({
    where: { solicitationId },
    create: {
      solicitationId,
      searchText,
      protocolo: solicitation.protocolo,
      tipoId: solicitation.tipoId,
      status: solicitation.status,
      departmentId: solicitation.departmentId,
      costCenterId: solicitation.costCenterId,
      solicitanteId: solicitation.solicitanteId,
    },
    update: {
      searchText,
      protocolo: solicitation.protocolo,
      tipoId: solicitation.tipoId,
      status: solicitation.status,
      departmentId: solicitation.departmentId,
      costCenterId: solicitation.costCenterId,
      solicitanteId: solicitation.solicitanteId,
    },
  })
}

export async function rebuildSolicitationSearchIndexBatch({ apply = false, take = 500 } = {}) {
  const solicitations = await prisma.solicitation.findMany({ take, orderBy: { dataAbertura: 'desc' }, select: { id: true } })
  if (!apply) return { planned: solicitations.length, updated: 0 }
  let updated = 0
  for (const solicitation of solicitations) {
    await upsertSolicitationSearchIndex(solicitation.id)
    updated += 1
  }
  return { planned: solicitations.length, updated }
}

export async function searchSolicitationIdsByText(q: string, baseWhere: Prisma.SolicitationWhereInput = {}, limit = 1000) {
  const term = normalizeSolicitationSearchText(q)
  if (!term) return []
  try {
    const rows = await prisma.solicitationSearchIndex.findMany({
      where: {
        searchText: { contains: term },
        solicitation: baseWhere,
      },
      take: limit,
      select: { solicitationId: true },
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((row) => row.solicitationId)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') return []
    throw err
  }
}
