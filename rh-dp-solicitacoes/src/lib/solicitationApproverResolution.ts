import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { WorkflowDraft } from '@/lib/solicitationWorkflowsStore'
import { readWorkflowRows } from '@/lib/solicitationWorkflowsStore'

type UserLike = { id: string; leaderId?: string | null; departmentId?: string | null; costCenterId?: string | null }
type TipoLike = { id: string; approvers?: Array<{ userId: string }> }

export async function resolveWorkflowForSolicitation(tipoId: string, departmentId?: string | null, _costCenterId?: string | null) {
  const workflows = (await readWorkflowRows()).filter((workflow) => workflow.tipoId === tipoId && workflow.active)
  return workflows.find((workflow) => (workflow.departmentId ?? null) === (departmentId ?? null)) ?? workflows.find((workflow) => !workflow.departmentId) ?? null
}

export async function resolveSolicitationApprovers({ tipo, workflow, solicitante }: { tipo: TipoLike; workflow?: WorkflowDraft | null; solicitante?: UserLike | null; payload?: unknown }) {
  const workflowApprovers = workflow?.steps.flatMap((step) => step.requiresApproval || step.kind === 'APROVACAO' ? (step.approverUserIds ?? []) : []) ?? []
  if (workflowApprovers.length) return { source: 'WORKFLOW', approverUserIds: Array.from(new Set(workflowApprovers)), required: true }
  const tipoApprovers = tipo.approvers?.map((item) => item.userId).filter(Boolean) ?? await prisma.tipoSolicitacaoApprover.findMany({ where: { tipoId: tipo.id }, select: { userId: true } }).then((rows) => rows.map((row) => row.userId))
  if (tipoApprovers.length) return { source: 'TIPO_SOLICITACAO', approverUserIds: Array.from(new Set(tipoApprovers)), required: true }
  if (solicitante?.leaderId) return { source: 'GESTOR_SOLICITANTE', approverUserIds: [solicitante.leaderId], required: false }
  return { source: 'NONE', approverUserIds: [], required: Boolean(workflow?.steps.some((step) => step.requiresApproval)) }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(value))
}

export function buildApprovalSnapshot(args: { workflow?: WorkflowDraft | null; approvers: { source: string; approverUserIds: string[]; required: boolean }; notifications?: unknown }) {
  if (args.approvers.required && args.approvers.approverUserIds.length === 0) throw new Error('Aprovação obrigatória sem aprovador configurado.')
  return { workflowSnapshotJson: toPrismaJson(args.workflow), approvalSnapshotJson: toPrismaJson(args.approvers), notificationSnapshotJson: toPrismaJson(args.notifications) }
}
