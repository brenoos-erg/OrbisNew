import { prisma } from '../src/lib/prisma'

function argValue(name: string) {
  const entry = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return entry ? entry.slice(name.length + 1) : null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const confirm = process.argv.includes('--confirm')
  const operatorId = argValue('--operator-id')
  const defaultScopeType = argValue('--scope-type') ?? 'DEPARTMENT'
  if (apply && (!confirm || !operatorId)) throw new Error('Use --apply --confirm --operator-id=<id> para aplicar a migração legada.')

  const controls = await prisma.documentApprovalControl.findMany({
    where: { active: true },
    include: { user: { select: { id: true, email: true, fullName: true, departmentId: true, costCenterId: true } } },
  })
  const planned = controls.flatMap((control) => {
    const roles = [] as Array<'TECHNICAL_APPROVER' | 'QUALITY_REVIEWER'>
    if (control.canApproveTab2) roles.push('TECHNICAL_APPROVER')
    if (control.canApproveTab3) roles.push('QUALITY_REVIEWER')
    return roles.map((role) => {
      const scopeType = defaultScopeType === 'COST_CENTER' && control.user.costCenterId ? 'COST_CENTER' : control.user.departmentId ? 'DEPARTMENT' : null
      const scopeKey = scopeType === 'COST_CENTER' ? control.user.costCenterId! : scopeType === 'DEPARTMENT' ? control.user.departmentId! : null
      return { userId: control.userId, email: control.user.email, fullName: control.user.fullName, role, scopeType, scopeKey, skipped: !scopeType, reason: !scopeType ? 'Escopo não inferido; informe departamento/centro antes de aplicar. GLOBAL não é atribuído silenciosamente.' : null }
    })
  })

  if (!apply) {
    console.info(JSON.stringify({ apply: false, message: 'Simulação: nenhum dado foi alterado.', plannedCount: planned.length, planned }, null, 2))
    return
  }

  let created = 0
  for (const item of planned) {
    if (item.skipped || !item.scopeType || !item.scopeKey) continue
    const exists = await prisma.documentRoleAssignment.findFirst({ where: { userId: item.userId, role: item.role, scopeType: item.scopeType as any, scopeKey: item.scopeKey } })
    if (exists) continue
    await prisma.documentRoleAssignment.create({ data: { userId: item.userId, role: item.role, scopeType: item.scopeType as any, scopeKey: item.scopeKey, departmentId: item.scopeType === 'DEPARTMENT' ? item.scopeKey : null, costCenterId: item.scopeType === 'COST_CENTER' ? item.scopeKey : null, active: true, createdById: operatorId!, justification: 'Migração idempotente de DocumentApprovalControl legado validada por operador administrativo.' } })
    created++
  }
  console.info(JSON.stringify({ apply: true, plannedCount: planned.length, created }, null, 2))
}

main().finally(() => prisma.$disconnect())
