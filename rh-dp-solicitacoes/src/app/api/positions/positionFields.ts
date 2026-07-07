export const positionSelect = {
  id: true, name: true, description: true, indexador: true, revision: true, documentDate: true, managerPosition: true, framing: true, areaSector: true, cbo: true, summary: true, detailedDescription: true,
  sectorProject: true, workplace: true, workSchedule: true, mainActivities: true, complementaryActivities: true, schooling: true, course: true, schoolingCompleted: true, courseInProgress: true, periodModule: true,
  requiredKnowledge: true, necessaryKnowledge: true, desiredKnowledge: true, behavioralCompetencies: true, humanCompetencies: true, functionalCompetencies: true, otherCompetencies: true,
  complexity: true, managementScope: true, confidentialDataAccess: true, responsibilities: true, workPoint: true, site: true, experience: true, active: true, latestDocumentId: true,
  documents: { orderBy: { uploadedAt: 'desc' as const }, select: { id: true, originalFilename: true, fileUrl: true, indexador: true, revision: true, documentDate: true, uploadedById: true, uploadedAt: true, isCurrent: true, uploadedBy: { select: { id: true, fullName: true, email: true } } } },
}

const textKeys = ['name','description','departmentId','sectorProject','workplace','workSchedule','mainActivities','complementaryActivities','schooling','course','schoolingCompleted','courseInProgress','periodModule','requiredKnowledge','behavioralCompetencies','enxoval','uniform','others','workPoint','site','experience','indexador','revision','managerPosition','framing','areaSector','cbo','summary','detailedDescription','necessaryKnowledge','desiredKnowledge','humanCompetencies','functionalCompetencies','otherCompetencies','complexity','managementScope','confidentialDataAccess','responsibilities'] as const
const otherKeys = ['documentDate','active'] as const
const keys = [...textKeys, ...otherKeys] as const

export function normalizePositionTextValue(value: unknown) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function positionDataFromBody(body: Record<string, any>) {
  const data: Record<string, any> = {}
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    data[key] = textKeys.includes(key as any) ? normalizePositionTextValue(body[key]) : body[key]
  }
  if (Object.prototype.hasOwnProperty.call(data, 'documentDate')) {
    if (data.documentDate === '' || data.documentDate === null || data.documentDate === undefined) {
      data.documentDate = null
    } else if (typeof data.documentDate === 'string') {
      const parsed = new Date(data.documentDate)
      if (Number.isNaN(parsed.getTime())) throw new Error('Data do documento inválida.')
      data.documentDate = parsed
    }
  }
  if (data.active === undefined) delete data.active
  return data
}

export function getPrismaP2002Message(error: unknown) {
  const e = error as { code?: string }
  if (e?.code !== 'P2002') return null
  return 'Já existe um cargo cadastrado com este nome.'
}

export function getPrismaP2000Message(error: unknown) {
  const e = error as { code?: string; meta?: { column_name?: string; column?: string; field_name?: string } }
  if (e?.code !== 'P2000') return null
  const field = e.meta?.column_name ?? e.meta?.column ?? e.meta?.field_name ?? 'desconhecido'
  return `O texto de um dos campos do cargo excede o limite permitido. Campo afetado: ${field}.`
}

export function withCurrentDocument(position: any) {
  const latestDocument = position.documents?.find((document: any) => document.isCurrent) ?? position.documents?.[0] ?? null
  const { documents, ...rest } = position
  return { ...rest, latestDocument, documentoAtual: latestDocument, documentHistory: position.documents ?? [] }
}


export async function findActivePositionWithSameIndexador(prisma: any, indexador: unknown, currentPositionId?: string | null) {
  const normalized = normalizePositionTextValue(indexador)
  if (!normalized || typeof normalized !== 'string') return null
  return prisma.position.findFirst({
    where: { indexador: normalized, active: true, ...(currentPositionId ? { id: { not: currentPositionId } } : {}) },
    select: { id: true },
  })
}

export async function ensureUniqueActiveIndexador(prisma: any, indexador: unknown, currentPositionId?: string | null) {
  const duplicate = await findActivePositionWithSameIndexador(prisma, indexador, currentPositionId)
  if (duplicate) {
    const error = new Error('Já existe um cargo ativo com este código/indexador.') as Error & { status?: number }
    error.status = 409
    throw error
  }
}
