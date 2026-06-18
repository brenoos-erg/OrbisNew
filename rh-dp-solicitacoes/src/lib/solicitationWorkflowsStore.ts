import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

export type WorkflowStepKind = 'DEPARTAMENTO' | 'APROVACAO' | 'FIM'
export type WorkflowTemplateDraft = { subject: string; body: string }
export type WorkflowNotificationChannels = { notifyRequester?: boolean; notifyDepartment?: boolean; notifyApprover?: boolean; notifyAdmins?: boolean }
export type WorkflowStepDraft = {
  order: number; stepKey: string; label: string; kind: WorkflowStepKind; defaultDepartmentId?: string | null; approverGroupId?: string | null; approverUserId?: string | null; approverUserIds?: string[]; requiresApproval?: boolean; canAssume?: boolean; canFinalize?: boolean; notificationEmails?: string[]; notificationTemplate?: WorkflowTemplateDraft; approvalTemplate?: WorkflowTemplateDraft; notificationChannels?: WorkflowNotificationChannels; notificationAdminEmails?: string[]; enabled?: boolean; posX?: number; posY?: number
}
export type WorkflowTransitionDraft = { fromStepKey: string; toStepKey: string }
export type WorkflowDraft = { id?: string; name: string; tipoId: string; departmentId?: string | null; active: boolean; steps: WorkflowStepDraft[]; transitions: WorkflowTransitionDraft[] }
export type WorkflowAuditContext = { actorId?: string | null; action?: string; ip?: string | null; userAgent?: string | null }

export const DEFAULT_TEMPLATE: WorkflowTemplateDraft = { subject: '[{tipoCodigo}] Nova etapa: {departamentoAtual}', body: 'Olá, o chamado {protocolo} ({tipoCodigo} - {tipoNome}) entrou na etapa {departamentoAtual}. Acesse: {link}' }

function normalizeTemplate(input?: Partial<WorkflowTemplateDraft> | null): WorkflowTemplateDraft { return { subject: input?.subject?.trim() || DEFAULT_TEMPLATE.subject, body: input?.body?.trim() || DEFAULT_TEMPLATE.body } }
function asStringArray(value: unknown): string[] { return Array.isArray(value) ? value.map(String).map((x) => x.trim()).filter(Boolean) : [] }
function asTemplate(value: unknown): WorkflowTemplateDraft { return normalizeTemplate(value && typeof value === 'object' ? value as Partial<WorkflowTemplateDraft> : null) }
function asChannels(value: unknown, kind: WorkflowStepKind): WorkflowNotificationChannels { const v = value && typeof value === 'object' ? value as WorkflowNotificationChannels : {}; return { notifyRequester: v.notifyRequester ?? false, notifyDepartment: v.notifyDepartment ?? true, notifyApprover: v.notifyApprover ?? kind === 'APROVACAO', notifyAdmins: v.notifyAdmins ?? false } }

function normalizeStep(step: WorkflowStepDraft): WorkflowStepDraft {
  const approverUserIds = Array.from(new Set([...(step.approverUserIds ?? []), ...(step.approverUserId ? [step.approverUserId] : [])].map((x) => x.trim()).filter(Boolean)))
  return { ...step, notificationEmails: Array.from(new Set((step.notificationEmails ?? []).map((x) => x.trim()).filter(Boolean))), approverUserIds, notificationTemplate: normalizeTemplate(step.notificationTemplate), approvalTemplate: normalizeTemplate(step.approvalTemplate), notificationChannels: asChannels(step.notificationChannels, step.kind), notificationAdminEmails: Array.from(new Set((step.notificationAdminEmails ?? []).map((x) => x.trim()).filter(Boolean))), enabled: step.enabled ?? true, requiresApproval: step.requiresApproval ?? step.kind === 'APROVACAO', canAssume: step.canAssume ?? false, canFinalize: step.canFinalize ?? false }
}

const includeWorkflow = { steps: { orderBy: { order: 'asc' as const } }, transitions: true }

type DbWorkflow = Awaited<ReturnType<typeof prisma.solicitationWorkflow.findFirst<{ include: typeof includeWorkflow }>>>

function dbToDraft(row: NonNullable<DbWorkflow>): WorkflowDraft {
  return { id: row.id, name: row.name, tipoId: row.tipoId, departmentId: row.departmentId, active: row.active, steps: row.steps.map((s) => normalizeStep({ order: s.order, stepKey: s.stepKey, label: s.label, kind: s.kind as WorkflowStepKind, defaultDepartmentId: s.defaultDepartmentId, approverGroupId: s.approverGroupId, requiresApproval: s.requiresApproval, canAssume: s.canAssume, canFinalize: s.canFinalize, enabled: s.enabled, notificationEmails: asStringArray(s.notificationEmailsJson), notificationTemplate: asTemplate(s.notificationTemplateJson), approvalTemplate: asTemplate(s.approvalTemplateJson), notificationChannels: asChannels(s.notificationChannelsJson, s.kind as WorkflowStepKind), notificationAdminEmails: asStringArray(s.notificationAdminEmailsJson), approverUserIds: asStringArray(s.approverUserIdsJson), posX: s.posX ?? undefined, posY: s.posY ?? undefined })), transitions: row.transitions.map((t) => ({ fromStepKey: t.fromStepKey, toStepKey: t.toStepKey })) }
}

export async function readWorkflowRows() {
  const rows = await prisma.solicitationWorkflow.findMany({ include: includeWorkflow, orderBy: { updatedAt: 'desc' } })
  return rows.map(dbToDraft)
}

export async function createWorkflowRow(input: WorkflowDraft, audit?: WorkflowAuditContext) {
  const id = input.id ?? crypto.randomUUID(); const steps = [...input.steps].sort((a,b)=>a.order-b.order).map(normalizeStep)
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.solicitationWorkflow.create({ data: { id, name: input.name, tipoId: input.tipoId, departmentId: input.departmentId ?? null, active: input.active, createdById: audit?.actorId ?? null, updatedById: audit?.actorId ?? null, steps: { create: steps.map((s) => ({ order: s.order, stepKey: s.stepKey, label: s.label, kind: s.kind, defaultDepartmentId: s.defaultDepartmentId ?? null, approverGroupId: s.approverGroupId ?? null, requiresApproval: Boolean(s.requiresApproval), canAssume: Boolean(s.canAssume), canFinalize: Boolean(s.canFinalize), enabled: s.enabled ?? true, notificationEmailsJson: s.notificationEmails ?? [], notificationTemplateJson: s.notificationTemplate ?? DEFAULT_TEMPLATE, approvalTemplateJson: s.approvalTemplate ?? DEFAULT_TEMPLATE, notificationChannelsJson: s.notificationChannels ?? {}, notificationAdminEmailsJson: s.notificationAdminEmails ?? [], approverUserIdsJson: s.approverUserIds ?? [], posX: s.posX, posY: s.posY })) }, transitions: { create: input.transitions.map((t) => ({ fromStepKey: t.fromStepKey, toStepKey: t.toStepKey })) } }, include: includeWorkflow })
    await tx.solicitationWorkflowAuditLog.create({ data: { workflowId: created.id, actorId: audit?.actorId ?? null, action: audit?.action ?? 'CREATE', beforeJson: null, afterJson: dbToDraft(created), ip: audit?.ip ?? null, userAgent: audit?.userAgent ?? null } })
    return created
  })
  return dbToDraft(row)
}

export async function updateWorkflowRow(id: string, input: WorkflowDraft, audit?: WorkflowAuditContext) {
  const before = await prisma.solicitationWorkflow.findUnique({ where: { id }, include: includeWorkflow })
  if (!before) return null
  const steps = [...input.steps].sort((a,b)=>a.order-b.order).map(normalizeStep)
  const row = await prisma.$transaction(async (tx) => {
    await tx.solicitationWorkflowStep.deleteMany({ where: { workflowId: id } }); await tx.solicitationWorkflowTransition.deleteMany({ where: { workflowId: id } })
    const updated = await tx.solicitationWorkflow.update({ where: { id }, data: { name: input.name, tipoId: input.tipoId, departmentId: input.departmentId ?? null, active: input.active, updatedById: audit?.actorId ?? null, steps: { create: steps.map((s) => ({ order: s.order, stepKey: s.stepKey, label: s.label, kind: s.kind, defaultDepartmentId: s.defaultDepartmentId ?? null, approverGroupId: s.approverGroupId ?? null, requiresApproval: Boolean(s.requiresApproval), canAssume: Boolean(s.canAssume), canFinalize: Boolean(s.canFinalize), enabled: s.enabled ?? true, notificationEmailsJson: s.notificationEmails ?? [], notificationTemplateJson: s.notificationTemplate ?? DEFAULT_TEMPLATE, approvalTemplateJson: s.approvalTemplate ?? DEFAULT_TEMPLATE, notificationChannelsJson: s.notificationChannels ?? {}, notificationAdminEmailsJson: s.notificationAdminEmails ?? [], approverUserIdsJson: s.approverUserIds ?? [], posX: s.posX, posY: s.posY })) }, transitions: { create: input.transitions.map((t) => ({ fromStepKey: t.fromStepKey, toStepKey: t.toStepKey })) } }, include: includeWorkflow })
    await tx.solicitationWorkflowAuditLog.create({ data: { workflowId: id, actorId: audit?.actorId ?? null, action: audit?.action ?? 'UPDATE', beforeJson: dbToDraft(before), afterJson: dbToDraft(updated), ip: audit?.ip ?? null, userAgent: audit?.userAgent ?? null } })
    return updated
  })
  return dbToDraft(row)
}
