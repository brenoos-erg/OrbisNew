import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type AuditLogInput = {
  actorId?: string | null
  entityType: string
  entityId?: string | null
  action: string
  beforeJson?: Prisma.InputJsonValue | null
  afterJson?: Prisma.InputJsonValue | null
  metadataJson?: Prisma.InputJsonValue | null
  ip?: string | null
  userAgent?: string | null
}

export async function recordAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({ data: { actorId: input.actorId ?? null, entityType: input.entityType, entityId: input.entityId ?? null, action: input.action, beforeJson: input.beforeJson ?? undefined, afterJson: input.afterJson ?? undefined, metadataJson: input.metadataJson ?? undefined, ip: input.ip ?? null, userAgent: input.userAgent ?? null } })
}
