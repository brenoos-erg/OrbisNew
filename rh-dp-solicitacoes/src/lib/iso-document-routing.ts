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
  routing?: Omit<DocumentRouting, 'message'>
}

export function resolveInitialVersionStatus(flow: Array<{ stepType: DocumentFlowStepType }>) {
  const firstStepType = flow[0]?.stepType ?? null

  if (flow.length === 0) {
    return DocumentVersionStatus.PUBLICADO
  }

  if (firstStepType === DocumentFlowStepType.QUALITY) {
    return DocumentVersionStatus.EM_ANALISE_QUALIDADE
  }

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

export function duplicateCodeMessage(code: string, status: DocumentVersionStatus) {
  const location = routingForStatus(status)
  return `Já existe um documento com o código ${code}. Ele está no status ${status} e pode ser consultado em ${location.targetPath}.`
}

export function orphanCodeMessage(code: string) {
  return `Já existe um cadastro com o código ${code}, mas sem versão ativa. O envio vai regularizar esse documento.`
}

export function evaluateCodeAvailability(code: string, status: DocumentVersionStatus | null): CodeAvailabilityFeedback {
  if (!status) {
    return {
      available: true,
      message: orphanCodeMessage(code),
    }
  }

  return {
    available: false,
    message: duplicateCodeMessage(code, status),
    routing: routingForStatus(status),
  }
}