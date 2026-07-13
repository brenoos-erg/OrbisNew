import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReviewQualityDocument } from '@/lib/documents/documentRoleAccess'
import { getCurrentPendingApprovalStep } from '@/lib/documents/documentApprovalTransition'

async function currentQualityStep(versionId: string) {
  const current = await getCurrentPendingApprovalStep(versionId)
  return current?.step.stepType === 'QUALITY' ? current : null
}

async function findCurrentChecklist(stepId: string, reviewerUserId: string) {
  return prisma.documentQualityChecklist.findFirst({
    where: { stepId, reviewerUserId },
    orderBy: [{ completedAt: 'asc' }, { updatedAt: 'desc' }],
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  if (!(await canReviewQualityDocument(me.id, versionId))) return NextResponse.json({ error: 'Acesso negado ao checklist da Qualidade.' }, { status: 403 })
  const current = await currentQualityStep(versionId)
  if (!current) return NextResponse.json({ error: 'Versão não está na etapa de Qualidade.' }, { status: 404 })
  const checklist = await findCurrentChecklist(current.step.id, me.id)
  return NextResponse.json({ checklist, roundId: current.round.id, stepId: current.step.id })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ versionId: string }> }) {
  const me = await requireActiveUser()
  const { versionId } = await params
  if (!(await canReviewQualityDocument(me.id, versionId))) return NextResponse.json({ error: 'Acesso negado ao checklist da Qualidade.' }, { status: 403 })
  const current = await currentQualityStep(versionId)
  if (!current) return NextResponse.json({ error: 'Versão não está na etapa de Qualidade.' }, { status: 404 })
  const body = await req.json().catch(() => null) ?? {}
  const lockName = `document-quality-checklist:${current.step.id}:${me.id}`
  const checklist = await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: number | bigint | null }>>`SELECT GET_LOCK(${lockName}, 10) AS locked`
    if (Number(lock[0]?.locked ?? 0) !== 1) throw new Error('Não foi possível bloquear o checklist da Qualidade.')
    try {
      const existing = await tx.documentQualityChecklist.findFirst({ where: { stepId: current.step.id, reviewerUserId: me.id }, orderBy: [{ completedAt: 'asc' }, { updatedAt: 'desc' }] })
      if (existing?.completedAt) throw new Error('Checklist já concluído.')
      return existing
        ? tx.documentQualityChecklist.update({ where: { id: existing.id }, data: { notes: body.notes ?? null, items: body.items ?? undefined, roundId: current.round.id, stepId: current.step.id } })
        : tx.documentQualityChecklist.create({ data: { versionId, roundId: current.round.id, stepId: current.step.id, reviewerUserId: me.id, notes: body.notes ?? null, items: body.items ?? undefined } })
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`.catch(() => undefined)
    }
  }).catch((error) => error instanceof Error && error.message === 'Checklist já concluído.' ? null : Promise.reject(error))
  if (!checklist) return NextResponse.json({ error: 'Checklist já concluído.' }, { status: 409 })
  return NextResponse.json(checklist)
}
