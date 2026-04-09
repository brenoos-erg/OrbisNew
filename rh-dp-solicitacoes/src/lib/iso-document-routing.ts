import { DocumentFlowStepType, DocumentVersionStatus } from '@prisma/client'

export type DocumentRouting = {
  status: DocumentVersionStatus
  targetTab: string
  targetPath: string
  message: string
}

export type CodeAvailabilityFeedback = {
  available: boolean
  message: string
  isRevision?: boolean
  currentRevisionNumber?: number | null
  routing?: Omit<DocumentRouting, 'message'>
}
export function resolveInitialVersionStatus(flow: Array<{ stepType: DocumentFlowStepType }>) {
  if (flow.length === 0) {
    return DocumentVersionStatus.PUBLICADO
  }

  // Regra padrão: toda nova versão inicia em aprovação de gestão.
  return DocumentVersionStatus.AG_APROVACAO
}


export function routingForStatus(status: DocumentVersionStatus): Omit<DocumentRouting, 'message'> {
  if (status === DocumentVersionStatus.PUBLICADO) {
    return {
      status,
      targetTab: 'publicados',
      targetPath: '/dashboard/controle-documentos/publicados',
    }
  }

  if (status === DocumentVersionStatus.EM_ANALISE_QUALIDADE) {
    return {
      status,
      targetTab: 'em-analise-qualidade',
      targetPath: '/dashboard/controle-documentos/em-analise-qualidade',
    }
  }

  if (status === DocumentVersionStatus.AG_APROVACAO) {
    return {
      status,
      targetTab: 'para-aprovacao',
      targetPath: '/dashboard/controle-documentos/para-aprovacao',
    }
  }

  return {
    status,
    targetTab: 'publicacao',
    targetPath: '/dashboard/controle-documentos/publicacao',
  }
}

export function createSuccessMessageByStatus(status: DocumentVersionStatus) {
  if (status === DocumentVersionStatus.PUBLICADO) {
    return 'Documento publicado com sucesso.'
  }

  if (status === DocumentVersionStatus.EM_ANALISE_QUALIDADE) {
    return 'Documento enviado com sucesso e encaminhado para revisão da qualidade.'
  }

  if (status === DocumentVersionStatus.AG_APROVACAO) {
    return 'Documento enviado com sucesso e encaminhado para aprovação.'
  }

  return 'Documento cadastrado com sucesso.'
}

export function existingCodeRevisionMessage(code: string, status: DocumentVersionStatus, currentRevisionNumber: number) {
  const location = routingForStatus(status)
  return `Código ${code} já cadastrado (revisão atual ${currentRevisionNumber}). O novo envio criará automaticamente a próxima revisão e seguirá o fluxo de aprovação padrão. Último status: ${status}.`
}

export function orphanCodeMessage(code: string) {
  return `Já existe um cadastro com o código ${code}, mas sem versão ativa. O envio vai regularizar esse documento.`
}

export function evaluateCodeAvailability(
  code: string,
  status: DocumentVersionStatus | null,
  currentRevisionNumber: number | null,
): CodeAvailabilityFeedback {
  if (!status || currentRevisionNumber === null) {
    return {
      available: true,
      isRevision: false,
      currentRevisionNumber: null,
      message: orphanCodeMessage(code),
    }
  }

  return {
    available: true,
    isRevision: true,
    currentRevisionNumber,
    message: existingCodeRevisionMessage(code, status, currentRevisionNumber),
    routing: routingForStatus(status),
  }
}