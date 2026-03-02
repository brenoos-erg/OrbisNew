import type { WorkflowStepKind } from '@/lib/solicitationWorkflowsStore'

export function buildWorkflowNotificationPath(stepKind: WorkflowStepKind, solicitationId: string) {
  if (stepKind === 'APROVACAO') {
    return `/dashboard/solicitacoes/aprovacao?solicitationId=${encodeURIComponent(solicitationId)}`
  }

  return `/dashboard/solicitacoes/${solicitationId}`
}