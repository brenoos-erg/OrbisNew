export const positionSelect = {
  id: true, name: true, description: true, indexador: true, revision: true, documentDate: true, managerPosition: true, framing: true, areaSector: true, cbo: true, summary: true, detailedDescription: true,
  sectorProject: true, workplace: true, workSchedule: true, mainActivities: true, complementaryActivities: true, schooling: true, course: true, schoolingCompleted: true, courseInProgress: true, periodModule: true,
  requiredKnowledge: true, necessaryKnowledge: true, desiredKnowledge: true, behavioralCompetencies: true, humanCompetencies: true, functionalCompetencies: true, otherCompetencies: true,
  complexity: true, managementScope: true, confidentialDataAccess: true, responsibilities: true, workPoint: true, site: true, experience: true, active: true, latestDocumentId: true,
  documents: { where: { isCurrent: true }, take: 1, orderBy: { uploadedAt: 'desc' as const }, select: { id: true, originalFilename: true, fileUrl: true, indexador: true, revision: true, documentDate: true, uploadedAt: true } },
}

const keys = ['name','description','departmentId','sectorProject','workplace','workSchedule','mainActivities','complementaryActivities','schooling','course','schoolingCompleted','courseInProgress','periodModule','requiredKnowledge','behavioralCompetencies','enxoval','uniform','others','workPoint','site','experience','indexador','revision','documentDate','managerPosition','framing','areaSector','cbo','summary','detailedDescription','necessaryKnowledge','desiredKnowledge','humanCompetencies','functionalCompetencies','otherCompetencies','complexity','managementScope','confidentialDataAccess','responsibilities','active']

export function positionDataFromBody(body: Record<string, any>) {
  const data: Record<string, any> = {}
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(body, key)) data[key] = body[key] === '' ? null : body[key]
  if (data.documentDate && typeof data.documentDate === 'string') data.documentDate = new Date(data.documentDate)
  if (data.active === undefined) delete data.active
  return data
}

export function withCurrentDocument(position: any) {
  const latestDocument = position.documents?.[0] ?? null
  const { documents, ...rest } = position
  return { ...rest, latestDocument, documentoAtual: latestDocument }
}
