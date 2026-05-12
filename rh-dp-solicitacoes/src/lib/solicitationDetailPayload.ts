export type DetailPermissionFlags = {
  viewerOnly: boolean
  canAssume: boolean
  canEdit: boolean
  canApprove: boolean
  canFinalize: boolean
  canCancel: boolean
  canComment: boolean
}

type AnyRecord = Record<string, any>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {}
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : value ? new Date(value as any).toISOString() : null
}


function isExperienceEvaluationTipo(tipo?: AnyRecord | null) {
  const id = String(tipo?.id ?? '').toUpperCase()
  const codigo = String(tipo?.codigo ?? '').toUpperCase()
  const nome = String(tipo?.nome ?? '').toUpperCase()
  return id === 'RQ_RH_103' || codigo === 'RQ_RH_103' || nome.includes('AVALIA') && nome.includes('EXPERI')
}

function resolvePrimaryResponsible(input: {
  tipo?: AnyRecord | null
  assumidaPor?: AnyRecord | null
  assumidaPorId?: string | null
  approver?: AnyRecord | null
  approverId?: string | null
}) {
  if (isExperienceEvaluationTipo(input.tipo)) {
    return {
      responsavelId: input.approver?.id ?? input.approverId ?? null,
      responsavel: input.approver?.fullName ? { fullName: input.approver.fullName } : null,
    }
  }

  return {
    responsavelId: input.assumidaPor?.id ?? input.assumidaPorId ?? null,
    responsavel: input.assumidaPor?.fullName ? { fullName: input.assumidaPor.fullName } : null,
  }
}

function safeSchemaJson(value: unknown) {
  const schema = asRecord(value)
  return {
    ...schema,
    camposEspecificos: asArray(schema.camposEspecificos),
    meta: asRecord(schema.meta),
  }
}

export function normalizeSolicitationPayload(payload: unknown): AnyRecord {
  const root = asRecord(payload)
  return {
    ...root,
    campos: asRecord(root.campos),
  }
}

export function buildSolicitationDetailPayload(input: {
  item: AnyRecord
  tipo?: AnyRecord | null
  approver?: AnyRecord | null
  assumidaPor?: AnyRecord | null
  costCenter?: AnyRecord | null
  department?: AnyRecord | null
  nonConformity?: AnyRecord | null
  comentarios?: AnyRecord[] | null
  eventos?: AnyRecord[] | null
  timelines?: AnyRecord[] | null
  solicitacaoSetores?: AnyRecord[] | null
  children?: AnyRecord[] | null
  documents?: AnyRecord[] | null
  attachments?: AnyRecord[] | null
  experienceEvaluators?: AnyRecord[] | null
  permissions: DetailPermissionFlags
}) {
  const item = asRecord(input.item)
  const tipo = input.tipo ? asRecord(input.tipo) : null
  const payload = normalizeSolicitationPayload(item.payload)
  const experienceEvaluators = asArray(input.experienceEvaluators)
  const normalizedPayload = payload
  const primaryResponsible = resolvePrimaryResponsible({
    tipo,
    assumidaPor: input.assumidaPor ?? null,
    assumidaPorId: item.assumidaPorId ?? null,
    approver: input.approver ?? null,
    approverId: item.approverId ?? null,
  })

  const attachments = asArray(input.attachments)
  const seenUrls = new Set<string>()
  const dedupedAttachments = attachments.filter((attachment) => {
    const key = String(attachment?.url ?? attachment?.id ?? '')
    if (!key) return true
    if (seenUrls.has(key)) return false
    seenUrls.add(key)
    return true
  })

  return {
    id: String(item.id ?? ''),
    protocolo: item.protocolo ?? null,
    titulo: item.titulo ?? '',
    descricao: item.descricao ?? null,
    status: item.status ?? null,
    approverId: item.approverId ?? null,
    assumidaPorId: item.assumidaPorId ?? null,
    responsavelAtualId: primaryResponsible.responsavelId ?? null,
    responsavelAtual: primaryResponsible.responsavel ?? null,
    approvalStatus: item.approvalStatus ?? null,
    ...input.permissions,
    dataAbertura: iso(item.dataAbertura),
    dataPrevista: iso(item.dataPrevista),
    dataFechamento: iso(item.dataFechamento),
    dataCancelamento: iso(item.dataCancelamento),
    cancelamentoStatus: item.cancelamentoStatus ?? null,
    cancelamentoSolicitadoPorId: item.cancelamentoSolicitadoPorId ?? null,
    cancelamentoSolicitadoEm: iso(item.cancelamentoSolicitadoEm),
    cancelamentoMotivo: item.cancelamentoMotivo ?? null,
    cancelamentoAnalisadoPorId: item.cancelamentoAnalisadoPorId ?? null,
    cancelamentoAnalisadoEm: iso(item.cancelamentoAnalisadoEm),
    cancelamentoJustificativaAnalise: item.cancelamentoJustificativaAnalise ?? null,
    cancelamentoOrigem: item.cancelamentoOrigem ?? null,
    tipo: tipo
      ? {
          id: tipo.id,
          codigo: tipo.codigo ?? null,
          nome: tipo.nome ?? '-',
          descricao: tipo.descricao ?? null,
          schemaJson: safeSchemaJson(tipo.schemaJson),
        }
      : null,
    costCenter: input.costCenter
      ? {
          description: input.costCenter.description ?? '-',
          code: input.costCenter.code ?? null,
          externalCode: input.costCenter.externalCode ?? null,
        }
      : null,
    department: input.department
      ? {
          id: input.department.id,
          name: input.department.name ?? '-',
          code: input.department.code ?? null,
        }
      : null,
    payload: normalizedPayload,
    dataSources: { experienceEvaluators },
    nonConformity: input.nonConformity
      ? {
          id: input.nonConformity.id,
          numeroRnc: input.nonConformity.numeroRnc ?? '-',
          status: input.nonConformity.status ?? null,
        }
      : null,
    anexos: dedupedAttachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename ?? 'anexo',
      url: `/api/solicitacoes/${attachment.solicitationId ?? item.id}/anexos/${attachment.id}`,
      mimeType: attachment.mimeType ?? null,
      sizeBytes: attachment.sizeBytes ?? null,
      createdAt: iso(attachment.createdAt),
    })),
    comentarios: asArray(input.comentarios).map((comment) => ({
      id: comment.id,
      texto: comment.texto ?? '',
      createdAt: iso(comment.createdAt),
      autor: comment.autor
        ? {
            id: comment.autor.id,
            fullName: comment.autor.fullName ?? '-',
            email: comment.autor.email ?? null,
          }
        : null,
    })),
    eventos: asArray(input.eventos).map((event) => ({
      id: event.id,
      tipo: event.tipo ?? null,
      createdAt: iso(event.createdAt),
      actorId: event.actorId ?? null,
    })),
    timelines: asArray(input.timelines).map((timeline) => ({
      id: timeline.id,
      status: timeline.status ?? null,
      message: timeline.message ?? null,
      createdAt: iso(timeline.createdAt),
    })),
    solicitacaoSetores: asArray(input.solicitacaoSetores).map((setor) => ({
      id: setor.id,
      setor: setor.setor ?? null,
      status: setor.status ?? null,
      constaFlag: setor.constaFlag ?? null,
      campos: asRecord(setor.campos),
      finalizadoEm: iso(setor.finalizadoEm),
      finalizadoPor: setor.finalizadoPor ?? null,
    })),
    children: asArray(input.children).map((child) => ({
      id: child.id,
      protocolo: child.protocolo ?? null,
      titulo: child.titulo ?? '',
      status: child.status ?? null,
      dataAbertura: iso(child.dataAbertura),
      tipo: child.tipo ? { nome: child.tipo.nome ?? '-' } : null,
      setorDestino: child.department?.name ?? null,
    })),
    documents: asArray(input.documents).map((doc) => ({
      id: doc.id,
      type: doc.type,
      title: doc.title ?? '',
      pdfUrl: doc.pdfUrl ?? null,
      signedPdfUrl: doc.signedPdfUrl ?? null,
      createdAt: iso(doc.createdAt),
      assignments: asArray(doc.assignments).map((assignment) => ({
        id: assignment.id,
        userId: assignment.userId,
        status: assignment.status,
        signedAt: iso(assignment.signedAt),
        vistoriaObservacoes: assignment.vistoriaObservacoes ?? null,
      })),
    })),
  }
}
