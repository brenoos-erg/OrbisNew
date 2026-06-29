import { PrismaClient } from '@prisma/client'
import { EXPERIENCE_EVALUATION_FINALIZATION_STATUS, EXPERIENCE_EVALUATION_STATUS, hasExperienceEvaluationPrintableData, resolveRhDepartmentForExperienceEvaluation } from '@/lib/experienceEvaluation'
import { isExperienceEvaluationTipo } from '@/lib/experienceEvaluationForm'
import { resolveExperienceEvaluationAssignedEvaluator } from '@/lib/experienceEvaluation.shared'

const prisma = new PrismaClient()

function arg(name: string) {
  const direct = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : ''
}
const protocols = (arg('protocols') || arg('protocol') || '').split(',').map((p) => p.trim()).filter(Boolean)
const apply = process.argv.includes('--apply')

async function resolveUser(assigned: ReturnType<typeof resolveExperienceEvaluationAssignedEvaluator>) {
  if (assigned.id) return prisma.user.findUnique({ where: { id: assigned.id }, select: { id: true, fullName: true, login: true, email: true } })
  const OR = [
    assigned.login ? { login: assigned.login } : null,
    assigned.email ? { email: assigned.email } : null,
    assigned.fullName ? { fullName: assigned.fullName } : null,
  ].filter(Boolean) as any[]
  return OR.length ? prisma.user.findFirst({ where: { OR }, select: { id: true, fullName: true, login: true, email: true } }) : null
}

async function main() {
  if (!protocols.length) throw new Error('Informe --protocol RQ... ou --protocols RQ1,RQ2')
  const rh = await resolveRhDepartmentForExperienceEvaluation()
  for (const protocolo of protocols) {
    const s = await prisma.solicitation.findUnique({ where: { protocolo }, include: { tipo: { select: { id: true, codigo: true, nome: true } } } })
    console.log(`\n${protocolo}`)
    if (!s) { console.log('  - não encontrada'); continue }
    if (!isExperienceEvaluationTipo({ id: s.tipo?.id ?? s.tipoId, codigo: s.tipo?.codigo, nome: s.tipo?.nome })) { console.log('  - não é avaliação de experiência'); continue }
    const assigned = resolveExperienceEvaluationAssignedEvaluator(s.payload)
    const user = await resolveUser(assigned)
    const hasEvaluation = hasExperienceEvaluationPrintableData(s.payload)
    const data: any = {}
    const changes: string[] = []
    if (hasEvaluation && s.status !== EXPERIENCE_EVALUATION_FINALIZATION_STATUS && !['CONCLUIDA','FINALIZADA','CANCELADA'].includes(String(s.status))) { data.status = EXPERIENCE_EVALUATION_FINALIZATION_STATUS; changes.push(`status -> ${EXPERIENCE_EVALUATION_FINALIZATION_STATUS}`) }
    if (hasEvaluation && rh?.departmentId && s.departmentId !== rh.departmentId) { data.departmentId = rh.departmentId; changes.push('departmentId -> RH') }
    if (hasEvaluation && rh?.costCenterId && s.costCenterId !== rh.costCenterId) { data.costCenterId = rh.costCenterId; changes.push('costCenterId -> RH/DP') }
    if (!hasEvaluation && !s.approverId && user?.id) { data.approverId = user.id; changes.push(`approverId -> ${user.fullName}`) }
    console.log(`  - avaliação preenchida: ${hasEvaluation ? 'sim' : 'não'}`)
    console.log(`  - avaliador resolvido: ${user?.fullName ?? assigned.fullName ?? assigned.login ?? assigned.email ?? assigned.id ?? '-'}`)
    console.log(`  - alterações: ${changes.join(', ') || 'nenhuma'}`)
    if (apply && changes.length) {
      await prisma.solicitation.update({ where: { id: s.id }, data })
      await prisma.solicitationTimeline.create({ data: { solicitationId: s.id, status: data.status ?? s.status as any, message: `Correção administrativa de avaliação de experiência parada: ${changes.join(', ')}.` } })
      console.log('  - aplicado: sim')
    } else console.log(`  - aplicado: ${apply ? 'sem alterações' : 'não (dry-run)'}`)
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
