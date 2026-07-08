import { prisma } from '@/lib/prisma'
import { buildEpiUniformeForwardToWarehouseData, getEpiWarehouseSetorKeys, resolveEpiWarehouseDepartments, resolveWarehouseCostCenter } from '@/lib/epiUniformeFlow'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'

const apply = process.argv.includes('--apply')
function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}
const protocols = (readArg('protocols') || readArg('protocol') || '').split(',').map((item) => item.trim()).filter(Boolean)

async function main() {
  if (protocols.length === 0) throw new Error('Informe --protocol ou --protocols. Correção em massa não é permitida.')
  const epiWarehouseDepartments = await resolveEpiWarehouseDepartments(prisma)
  const warehouse = epiWarehouseDepartments.almoxarifado
  if (!warehouse) throw new Error('Departamento de Almoxarifado/Estoque não encontrado.')
  const warehouseCostCenter = await resolveWarehouseCostCenter(prisma, warehouse.id)
  const solicitations = await prisma.solicitation.findMany({ where: { protocolo: { in: protocols } }, include: { tipo: true, department: { select: { code: true, name: true } } } })
  for (const solicitation of solicitations) {
    if (!isSolicitacaoEpiUniforme(solicitation.tipo)) { console.log(`${solicitation.protocolo}: ignorada; não é RQ_043.`); continue }
    if (solicitation.approvalStatus !== 'APROVADO') { console.log(`${solicitation.protocolo}: ignorada; approvalStatus=${solicitation.approvalStatus}, esperado APROVADO.`); continue }
    console.log(`${apply ? 'Corrigindo' : 'Simularia corrigir'} ${solicitation.protocolo}: ${solicitation.department?.code ?? '-'} / ${solicitation.department?.name ?? '-'} -> ${warehouse.code ?? '-'} / ${warehouse.name}`)
    if (!apply) continue
    await prisma.solicitation.update({ where: { id: solicitation.id }, data: buildEpiUniformeForwardToWarehouseData({ warehouseDepartmentId: warehouse.id, warehouseCostCenterId: warehouseCostCenter?.id ?? null }) })
    for (const setor of getEpiWarehouseSetorKeys()) { await prisma.solicitacaoSetor.upsert({ where: { solicitacaoId_setor: { solicitacaoId: solicitation.id, setor } }, update: { status: 'PENDENTE', finalizadoEm: null, finalizadoPor: null }, create: { solicitacaoId: solicitation.id, setor, status: 'PENDENTE' } }) }
    await prisma.solicitationTimeline.create({ data: { solicitationId: solicitation.id, status: 'AGUARDANDO_ATENDIMENTO', message: 'Correção técnica: solicitação de EPI aprovada pelo SST encaminhada para Almoxarifado/Logística.' } })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => prisma.$disconnect())
