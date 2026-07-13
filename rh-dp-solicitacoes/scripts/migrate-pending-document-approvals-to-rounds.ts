import fs from 'node:fs/promises'
import path from 'node:path'
import { DocumentApprovalDecisionStatus, DocumentApprovalRoundStatus, DocumentApprovalStepStatus, DocumentApprovalStatus, DocumentFlowStepType, DocumentVersionStatus } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { advanceDocumentWorkflow, startDocumentApprovalFlow } from '../src/lib/documents/documentApprovalTransition'

const apply = process.argv.includes('--apply')
const confirm = process.argv.includes('--confirm')
const outputArg = process.argv.find((arg) => arg.startsWith('--output='))
const output = outputArg?.split('=')[1] ?? path.join(process.cwd(), 'storage', 'reports', 'pending-document-approval-rounds.json')

async function main() {
  if (apply && !confirm) throw new Error('Use --apply --confirm para executar o backfill. Sem confirmação o script roda somente em simulação.')
  const versions = await prisma.documentVersion.findMany({
    where: { status: { in: [DocumentVersionStatus.AG_APROVACAO, DocumentVersionStatus.EM_ANALISE_QUALIDADE] }, approvalRounds: { none: {} } },
    include: {
      approvals: true,
      document: { include: { documentType: { include: { approvalFlowItems: { where: { active: true }, orderBy: { order: 'asc' }, include: { approverGroup: { include: { members: { include: { user: { select: { status: true } } } } } } } } } } } },
    },
  })
  const report = [] as any[]
  for (const version of versions) {
    const flow = version.document.documentType.approvalFlowItems
    const legacyByFlow = new Map(version.approvals.map((approval) => [approval.flowItemId, approval]))
    const completedTechnical = flow.filter((item) => item.stepType !== DocumentFlowStepType.QUALITY && legacyByFlow.get(item.id)?.status === DocumentApprovalStatus.APPROVED).map((item) => item.id)
    const reachedQuality = version.status === DocumentVersionStatus.EM_ANALISE_QUALIDADE || completedTechnical.length > 0
    const item = { versionId: version.id, documentId: version.documentId, status: version.status, flowItems: flow.length, completedTechnical, reachedQuality, action: apply ? 'APPLY' : 'DRY_RUN' }
    if (apply && flow.length > 0) {
      await prisma.$transaction(async (tx) => {
        const round = await startDocumentApprovalFlow(tx, { versionId: version.id, flow })
        for (const step of await tx.documentApprovalStep.findMany({ where: { roundId: round.id } })) {
          const legacy = legacyByFlow.get(step.flowItemId)
          if (!legacy || legacy.status === DocumentApprovalStatus.PENDING) continue
          const legacyStatus = String(legacy.status)
          const decisionStatus =
            legacyStatus === 'APPROVED' ? DocumentApprovalDecisionStatus.APPROVED :
            legacyStatus === 'REJECTED' ? DocumentApprovalDecisionStatus.REJECTED :
            legacyStatus === 'WAIVED' ? DocumentApprovalDecisionStatus.WAIVED :
            DocumentApprovalDecisionStatus.PENDING
          await tx.documentApprovalDecision.updateMany({ where: { stepId: step.id }, data: { status: DocumentApprovalDecisionStatus.WAIVED, waivedAt: new Date(), waiveReason: 'Backfill: decisão legada preservada em outra decisão da etapa.' } })
          if (legacy.decidedById) {
            await tx.documentApprovalDecision.upsert({
              where: { stepId_userId: { stepId: step.id, userId: legacy.decidedById } },
              update: { status: decisionStatus, decidedAt: legacy.decidedAt, comment: legacy.comment },
              create: { stepId: step.id, userId: legacy.decidedById, status: decisionStatus, decidedAt: legacy.decidedAt, comment: legacy.comment },
            })
          }
          if (decisionStatus === DocumentApprovalDecisionStatus.APPROVED) await tx.documentApprovalStep.update({ where: { id: step.id }, data: { status: DocumentApprovalStepStatus.APPROVED, completedAt: legacy.decidedAt ?? new Date() } })
          if (decisionStatus === DocumentApprovalDecisionStatus.REJECTED) await tx.documentApprovalStep.update({ where: { id: step.id }, data: { status: DocumentApprovalStepStatus.REJECTED, completedAt: legacy.decidedAt ?? new Date() } })
          if (decisionStatus === DocumentApprovalDecisionStatus.WAIVED) {
            await tx.documentApprovalStep.update({ where: { id: step.id }, data: { status: DocumentApprovalStepStatus.WAIVED, completedAt: legacy.decidedAt ?? new Date() } })
            await tx.documentApprovalDecision.updateMany({ where: { stepId: step.id }, data: { status: DocumentApprovalDecisionStatus.WAIVED, waivedAt: legacy.decidedAt ?? new Date(), waivedById: legacy.decidedById ?? undefined, waiveReason: legacy.comment ?? 'Backfill: aprovação legada dispensada administrativamente.' } })
          }
        }
        const anyRejected = await tx.documentApprovalStep.count({ where: { roundId: round.id, status: DocumentApprovalStepStatus.REJECTED } })
        if (anyRejected) {
          await tx.documentApprovalDecision.updateMany({ where: { step: { roundId: round.id }, status: DocumentApprovalDecisionStatus.PENDING }, data: { status: DocumentApprovalDecisionStatus.WAIVED, waivedAt: new Date(), waiveReason: 'Backfill: rodada legada reprovada.' } })
          await tx.documentApprovalStep.updateMany({ where: { roundId: round.id, status: DocumentApprovalStepStatus.PENDING }, data: { status: DocumentApprovalStepStatus.CANCELLED, completedAt: new Date() } })
          await tx.documentApprovalRound.update({ where: { id: round.id }, data: { status: DocumentApprovalRoundStatus.REJECTED, completedAt: new Date() } })
          await tx.documentVersion.update({ where: { id: version.id }, data: { status: DocumentVersionStatus.EM_ELABORACAO } })
        } else {
          if (reachedQuality) {
            await tx.documentApprovalStep.updateMany({ where: { roundId: round.id, stepType: { not: DocumentFlowStepType.QUALITY } }, data: { status: DocumentApprovalStepStatus.APPROVED, completedAt: new Date() } })
            await tx.documentApprovalDecision.updateMany({ where: { step: { roundId: round.id, stepType: { not: DocumentFlowStepType.QUALITY } }, status: DocumentApprovalDecisionStatus.PENDING }, data: { status: DocumentApprovalDecisionStatus.WAIVED, waivedAt: new Date(), waiveReason: 'Backfill: etapa técnica legada concluída.' } })
          }
          await advanceDocumentWorkflow(tx, { versionId: version.id })
        }
      })
    }
    report.push(item)
  }
  const payload = { apply, confirm, total: report.length, report, generatedAt: new Date().toISOString() }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(JSON.stringify(payload, null, 2))
}

main().finally(() => prisma.$disconnect())
