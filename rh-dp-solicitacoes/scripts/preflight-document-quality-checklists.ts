import fs from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const confirm = args.includes('--confirm')
const outputArg = args.find((arg) => arg.startsWith('--output='))
const output = outputArg?.split('=')[1] ?? path.join(process.cwd(), 'storage', 'reports', 'document-quality-checklist-preflight.json')

type Row = Record<string, any>

type Action = { action: string; id?: string; severity?: string; [key: string]: unknown }

async function query(sql: string) {
  return prisma.$queryRawUnsafe<Row[]>(sql)
}

async function runChecks() {
  return {
    nullRoundId: await query('SELECT id, versionId, reviewerUserId, stepId, result, createdAt, completedAt FROM DocumentQualityChecklist WHERE roundId IS NULL'),
    nullStepId: await query('SELECT id, versionId, reviewerUserId, roundId, result, createdAt, completedAt FROM DocumentQualityChecklist WHERE stepId IS NULL'),
    missingRound: await query(`
      SELECT c.id, c.versionId, c.roundId
      FROM DocumentQualityChecklist c
      LEFT JOIN DocumentApprovalRound r ON r.id = c.roundId
      WHERE c.roundId IS NOT NULL AND r.id IS NULL
    `),
    missingStep: await query(`
      SELECT c.id, c.versionId, c.stepId
      FROM DocumentQualityChecklist c
      LEFT JOIN DocumentApprovalStep s ON s.id = c.stepId
      WHERE c.stepId IS NOT NULL AND s.id IS NULL
    `),
    roundVersionMismatch: await query(`
      SELECT c.id, c.versionId AS checklistVersionId, c.roundId, r.versionId AS roundVersionId
      FROM DocumentQualityChecklist c
      JOIN DocumentApprovalRound r ON r.id = c.roundId
      WHERE c.roundId IS NOT NULL AND r.versionId <> c.versionId
    `),
    stepRoundMismatch: await query(`
      SELECT c.id, c.roundId AS checklistRoundId, c.stepId, s.roundId AS stepRoundId
      FROM DocumentQualityChecklist c
      JOIN DocumentApprovalStep s ON s.id = c.stepId
      WHERE c.stepId IS NOT NULL AND c.roundId IS NOT NULL AND s.roundId <> c.roundId
    `),
    stepVersionMismatch: await query(`
      SELECT c.id, c.versionId AS checklistVersionId, c.stepId, s.versionId AS stepVersionId
      FROM DocumentQualityChecklist c
      JOIN DocumentApprovalStep s ON s.id = c.stepId
      WHERE c.stepId IS NOT NULL AND s.versionId <> c.versionId
    `),
    nonQualityStep: await query(`
      SELECT c.id, c.stepId, s.stepType
      FROM DocumentQualityChecklist c
      JOIN DocumentApprovalStep s ON s.id = c.stepId
      WHERE c.stepId IS NOT NULL AND s.stepType <> 'QUALITY'
    `),
    reviewerWithoutDecision: await query(`
      SELECT c.id, c.stepId, c.reviewerUserId
      FROM DocumentQualityChecklist c
      JOIN DocumentApprovalStep s ON s.id = c.stepId
      LEFT JOIN DocumentApprovalDecision d ON d.stepId = c.stepId AND d.userId = c.reviewerUserId
      WHERE c.stepId IS NOT NULL AND d.id IS NULL
    `),
    duplicatesByStepReviewer: await query(`
      SELECT stepId, reviewerUserId, COUNT(*) AS total,
        GROUP_CONCAT(id ORDER BY completedAt IS NULL, completedAt DESC, updatedAt DESC) AS ids,
        COUNT(DISTINCT result) AS distinctResults,
        GROUP_CONCAT(DISTINCT result ORDER BY result) AS results
      FROM DocumentQualityChecklist
      WHERE stepId IS NOT NULL
      GROUP BY stepId, reviewerUserId
      HAVING COUNT(*) > 1
    `),
    conflictingDuplicates: await query(`
      SELECT stepId, reviewerUserId, COUNT(*) AS total, COUNT(DISTINCT result) AS distinctResults,
        GROUP_CONCAT(id ORDER BY completedAt IS NULL, completedAt DESC, updatedAt DESC) AS ids,
        GROUP_CONCAT(DISTINCT result ORDER BY result) AS results
      FROM DocumentQualityChecklist
      WHERE stepId IS NOT NULL
      GROUP BY stepId, reviewerUserId
      HAVING COUNT(*) > 1 AND COUNT(DISTINCT result) > 1
    `),
  }
}

function countInconsistencies(checks: Record<string, unknown>) {
  return Object.values(checks).reduce<number>((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)
}

function inRoundWindow(row: Row) {
  const created = row.checklistCreatedAt ? new Date(row.checklistCreatedAt).getTime() : 0
  const completed = row.checklistCompletedAt ? new Date(row.checklistCompletedAt).getTime() : created
  const started = row.roundStartedAt ? new Date(row.roundStartedAt).getTime() : 0
  const finished = row.roundCompletedAt ? new Date(row.roundCompletedAt).getTime() : Number.MAX_SAFE_INTEGER
  return created >= started && completed <= finished
}

async function findCaseA(row: Row) {
  const candidates = await query(`
    SELECT s.id AS stepId, s.roundId
    FROM DocumentApprovalStep s
    JOIN DocumentApprovalDecision d ON d.stepId = s.id AND d.userId = '${String(row.reviewerUserId).replace(/'/g, "''")}'
    WHERE s.roundId = '${String(row.roundId).replace(/'/g, "''")}' AND s.stepType = 'QUALITY'
  `)
  return candidates
}

async function findCaseB(row: Row) {
  return query(`
    SELECT s.id AS stepId, s.roundId, s.versionId
    FROM DocumentApprovalStep s
    WHERE s.id = '${String(row.stepId).replace(/'/g, "''")}' AND s.versionId = '${String(row.versionId).replace(/'/g, "''")}'
  `)
}

async function findCaseC(row: Row) {
  const candidates = await query(`
    SELECT s.id AS stepId, s.roundId, r.startedAt AS roundStartedAt, r.completedAt AS roundCompletedAt,
      c.createdAt AS checklistCreatedAt, c.completedAt AS checklistCompletedAt
    FROM DocumentQualityChecklist c
    JOIN DocumentApprovalRound r ON r.versionId = c.versionId
    JOIN DocumentApprovalStep s ON s.roundId = r.id AND s.versionId = c.versionId AND s.stepType = 'QUALITY'
    JOIN DocumentApprovalDecision d ON d.stepId = s.id AND d.userId = c.reviewerUserId
    WHERE c.id = '${String(row.id).replace(/'/g, "''")}'
  `)
  return candidates.filter(inRoundWindow)
}

async function backfillNullLinks(before: Awaited<ReturnType<typeof runChecks>>, actions: Action[], manualReview: Action[]) {
  const seen = new Set<string>()
  for (const row of before.nullStepId as Row[]) {
    if (row.roundId && !seen.has(row.id)) {
      const candidates = await findCaseA(row)
      if (candidates.length === 1) {
        await prisma.documentQualityChecklist.update({ where: { id: String(row.id) }, data: { stepId: String(candidates[0].stepId) } })
        actions.push({ action: 'CASE_A_BACKFILLED_STEP', id: row.id, roundId: row.roundId, stepId: candidates[0].stepId })
      } else {
        manualReview.push({ action: 'MANUAL_REVIEW_REQUIRED', id: row.id, case: 'A', candidates: candidates.map((item) => item.stepId) })
      }
      seen.add(row.id)
    }
  }
  for (const row of before.nullRoundId as Row[]) {
    if (row.stepId && !seen.has(row.id)) {
      const candidates = await findCaseB(row)
      if (candidates.length === 1) {
        await prisma.documentQualityChecklist.update({ where: { id: String(row.id) }, data: { roundId: String(candidates[0].roundId) } })
        actions.push({ action: 'CASE_B_BACKFILLED_ROUND', id: row.id, roundId: candidates[0].roundId, stepId: row.stepId })
      } else {
        manualReview.push({ action: 'MANUAL_REVIEW_REQUIRED', id: row.id, case: 'B', candidates })
      }
      seen.add(row.id)
    }
  }
  for (const row of before.nullRoundId as Row[]) {
    if (!row.stepId && !seen.has(row.id)) {
      const candidates = await findCaseC(row)
      if (candidates.length === 1) {
        await prisma.documentQualityChecklist.update({ where: { id: String(row.id) }, data: { roundId: String(candidates[0].roundId), stepId: String(candidates[0].stepId) } })
        actions.push({ action: 'CASE_C_BACKFILLED_ROUND_AND_STEP', id: row.id, roundId: candidates[0].roundId, stepId: candidates[0].stepId })
      } else {
        manualReview.push({ action: 'MANUAL_REVIEW_REQUIRED', id: row.id, case: 'C', candidates: candidates.map((item) => ({ roundId: item.roundId, stepId: item.stepId })) })
      }
      seen.add(row.id)
    }
  }
}

async function main() {
  const before = await runChecks()
  const actions: Action[] = []
  const manualReview: Action[] = []

  for (const row of before.duplicatesByStepReviewer as Row[]) {
    const ids = String(row.ids ?? '').split(',').filter(Boolean)
    const entry: Action = {
      action: Number(row.distinctResults) > 1 ? 'CRITICAL_CONFLICT' : 'MANUAL_REVIEW_REQUIRED',
      severity: Number(row.distinctResults) > 1 ? 'critical' : 'manual',
      stepId: row.stepId,
      reviewerUserId: row.reviewerUserId,
      ids,
      results: row.results,
      suggestedPrimaryId: ids[0] ?? null,
    }
    manualReview.push(entry)
  }

  if (apply) {
    if (!confirm) throw new Error('Use --apply --confirm para executar backfill do checklist.')
    if ((before.conflictingDuplicates as Row[]).length > 0) throw new Error('Duplicidades com resultados divergentes exigem decisão manual antes do backfill.')
    await backfillNullLinks(before, actions, manualReview)
  }

  const after = await runChecks()
  const beforeCount = countInconsistencies(before)
  const afterCount = countInconsistencies(after)
  const report = { generatedAt: new Date().toISOString(), apply, confirm, before, actions, manualReview, after, beforeInconsistencyCount: beforeCount, afterInconsistencyCount: afterCount, ok: afterCount === 0 }
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ ok: report.ok, output, beforeInconsistencyCount: beforeCount, afterInconsistencyCount: afterCount }, null, 2))
  if (!report.ok) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
