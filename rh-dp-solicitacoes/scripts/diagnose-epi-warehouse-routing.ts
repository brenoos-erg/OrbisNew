import { prisma } from '@/lib/prisma'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { resolveWarehouseDepartment } from '@/lib/epiUniformeFlow'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}

const protocols = (readArg('protocols') || readArg('protocol') || '').split(',').map((item) => item.trim()).filter(Boolean)
const userEmail = readArg('user-email') || 'estoque@ergengenharia.com.br'

async function appearsInReceivedForUser(solicitationId: string, userEmailOrLogin: string) {
  const user = await prisma.user.findFirst({ where: { OR: [{ email: userEmailOrLogin }, { login: userEmailOrLogin }] }, include: { department: true } })
  if (!user) return { appears: false, user: null }
  const ctx = await resolveUserAccessContext({ userId: user.id, userLogin: user.login, userEmail: user.email, userFullName: user.fullName, role: user.role, primaryDepartmentId: user.departmentId, primaryDepartment: user.department })
  const where = buildReceivedWhereByPolicy(ctx, { id: solicitationId }, { excludePendingRq063: true })
  return { appears: (await prisma.solicitation.count({ where })) > 0, user }
}

function possibleReason(solicitation: any, warehouseDepartmentId?: string | null) {
  if (solicitation.approvalStatus !== 'APROVADO') return `approvalStatus=${solicitation.approvalStatus}; ainda não foi aprovada.`
  if (!warehouseDepartmentId) return 'Departamento de Almoxarifado/Estoque não encontrado por nome ou sigla.'
  if (solicitation.departmentId !== warehouseDepartmentId) return 'Solicitação aprovada permanece em outro departamento; precisa ser encaminhada ao Almoxarifado.'
  if (['CANCELADA', 'CONCLUIDA'].includes(String(solicitation.status))) return `status=${solicitation.status}; fora da fila de Recebidas.`
  if (solicitation.assumidaPorId) return `assumidaPorId=${solicitation.assumidaPorId}; já está assumida.`
  return 'Roteamento parece correto; conferir vínculo/permissão do usuário ao departamento do Almoxarifado.'
}

async function main() {
  const warehouse = await resolveWarehouseDepartment(prisma)
  console.log(`Almoxarifado resolvido: ${warehouse ? `${warehouse.id} | ${warehouse.code ?? '-'} | ${warehouse.sigla ?? '-'} | ${warehouse.name}` : 'não encontrado'}`)
  const solicitations = await prisma.solicitation.findMany({
    where: { ...(protocols.length ? { protocolo: { in: protocols } } : { approvalStatus: 'APROVADO' }) },
    include: { tipo: true, department: { select: { id: true, code: true, name: true, sigla: true } }, costCenter: { select: { id: true, code: true, description: true, abbreviation: true } }, anexos: { select: { id: true, filename: true } }, solicitacaoSetores: { select: { setor: true, status: true, constaFlag: true } } },
    orderBy: { dataAbertura: 'desc' },
    take: protocols.length ? undefined : 100,
  })
  const epiApproved = solicitations.filter((item) => isSolicitacaoEpiUniforme(item.tipo) && item.approvalStatus === 'APROVADO')
  if (epiApproved.length === 0) console.log('Nenhuma RQ_043 aprovada encontrada para os filtros informados.')
  for (const solicitation of epiApproved) {
    const visibility = await appearsInReceivedForUser(solicitation.id, userEmail)
    console.log(`\n${solicitation.protocolo}`)
    console.log(`  - status: ${solicitation.status}`)
    console.log(`  - approvalStatus: ${solicitation.approvalStatus}`)
    console.log(`  - department atual: ${solicitation.department?.code ?? '-'} / ${solicitation.department?.sigla ?? '-'} / ${solicitation.department?.name ?? '-'}`)
    console.log(`  - costCenter atual: ${solicitation.costCenter?.code ?? '-'} / ${solicitation.costCenter?.abbreviation ?? '-'} / ${solicitation.costCenter?.description ?? '-'}`)
    console.log(`  - solicitacaoSetores: ${solicitation.solicitacaoSetores.map((s) => `${s.setor}:${s.status}`).join(', ') || '-'}`)
    console.log(`  - tem ficha/anexo: ${solicitation.anexos.length > 0 ? 'sim' : 'não'}`)
    console.log('  - já foi aprovada: sim')
    console.log('  - deveria estar no Almoxarifado: sim')
    console.log(`  - aparece em Recebidas para ${visibility.user?.fullName ?? userEmail}: ${visibility.appears ? 'sim' : 'não'}`)
    console.log(`  - possível motivo de não aparecer para o Thiago/equipe: ${visibility.appears ? 'Sem bloqueio identificado na política de Recebidas.' : possibleReason(solicitation, warehouse?.id)}`)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
