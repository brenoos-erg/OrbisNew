import { prisma } from '@/lib/prisma'
import { normalizeStoredAttachmentUrl, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { assertCanMoveEpiUniformeToSst, buildEpiUniformeForwardApprovalData, buildEpiUniformeMoveToSstData, isEpiUniformeReadyToForwardApproval } from '@/lib/epiUniformeFlow'
import { resolveTipoApproverId } from '@/lib/solicitationTipoApprovers'

const apply = process.argv.includes('--apply')
const moveToSst = process.argv.includes('--move-to-sst') || process.argv.includes('--corrigir-departamento')

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}
const protocols = (readArg('protocols') || readArg('protocol') || '').split(',').map((item) => item.trim()).filter(Boolean)

async function resolveSstDepartmentAndCostCenter() {
  const [department, costCenter] = await Promise.all([
    prisma.department.findFirst({
      where: { OR: [{ code: '19' }, { name: { contains: 'Segurança do Trabalho' } }] },
      select: { id: true, code: true, name: true },
    }),
    prisma.costCenter.findFirst({
      where: {
        OR: [
          { externalCode: '580' },
          { code: '580' },
          { description: { contains: 'Segurança do Trabalho' } },
        ],
      },
      select: { id: true, code: true, externalCode: true, description: true },
    }),
  ])
  if (!department) throw new Error('Departamento 19 - Segurança do Trabalho não encontrado.')
  return { department, costCenter }
}

async function main() {
  assertCanMoveEpiUniformeToSst(moveToSst, protocols)
  const attachments = await prisma.attachment.findMany({ where: { url: { startsWith: '/upload/documents/' } } })
  for (const attachment of attachments) {
    const normalizedUrl = normalizeStoredAttachmentUrl(attachment.url)
    console.log(`${apply ? 'Atualizando' : 'Simularia'} anexo ${attachment.id}: ${attachment.url} -> ${normalizedUrl}`)
    if (apply && normalizedUrl) await prisma.attachment.update({ where: { id: attachment.id }, data: { url: normalizedUrl } })
  }

  const solicitations = await prisma.solicitation.findMany({
    where: {
      ...(protocols.length ? { protocolo: { in: protocols } } : {}),
      NOT: { status: { in: ['CONCLUIDA', 'CANCELADA'] } },
    },
    include: { tipo: true, department: { select: { id: true, code: true, name: true } }, anexos: true },
  })

  const { department: sstDepartment, costCenter: sstCostCenter } = await resolveSstDepartmentAndCostCenter()

  for (const solicitation of solicitations.filter((item) => isSolicitacaoEpiUniforme(item.tipo))) {
    const hasExistingAttachment = (await Promise.all(solicitation.anexos.map((attachment) => resolveExistingAttachmentPath(attachment.url)))).some(Boolean)

    if (solicitation.department?.code !== '19') {
      console.log(`${apply && moveToSst ? 'Reencaminhando' : 'Simularia reencaminhar'} ${solicitation.protocolo} do departamento ${solicitation.department?.code ?? '-'} / ${solicitation.department?.name ?? '-'} para 19 / ${sstDepartment.name}${sstCostCenter ? ` / centro ${sstCostCenter.externalCode ?? sstCostCenter.code ?? '580'}` : ''}. Use --apply --move-to-sst com --protocol ou --protocols para alterar departamento.`)
      if (apply && moveToSst) {
        await prisma.solicitation.update({ where: { id: solicitation.id }, data: buildEpiUniformeMoveToSstData(sstDepartment.id, sstCostCenter?.id) })
        await prisma.solicitationTimeline.create({ data: { solicitationId: solicitation.id, status: solicitation.status, message: 'Solicitação de EPI reencaminhada para 19 - Segurança do Trabalho / centro 580 pelo script de correção.' } })
      }
      continue
    }

    if (!hasExistingAttachment) {
      console.log(`${solicitation.protocolo} está no SST sem ficha/anexo. Mantido em Recebidas como aguardando SST anexar Ficha de EPI; não será enviado para Aprovações.`)
      continue
    }

    if (solicitation.requiresApproval === true && solicitation.approvalStatus === 'PENDENTE') continue
    if (['APROVADO', 'REPROVADO'].includes(String(solicitation.approvalStatus))) continue
    if (!isEpiUniformeReadyToForwardApproval(solicitation)) {
      console.log(`${solicitation.protocolo} tem ficha no SST, mas estava fora do estado padrão de encaminhamento automático (requiresApproval=${solicitation.requiresApproval}, approvalStatus=${solicitation.approvalStatus}, status=${solicitation.status}).`)
    }
    const approverId = await resolveTipoApproverId(solicitation.tipoId)
    console.log(`${apply ? 'Encaminhando' : 'Simularia encaminhar'} ${solicitation.protocolo} para aprovação. approverId=${approverId ?? '-'}`)
    if (apply && approverId) {
      await prisma.solicitation.update({ where: { id: solicitation.id }, data: buildEpiUniformeForwardApprovalData(approverId) })
      await prisma.solicitationTimeline.create({ data: { solicitationId: solicitation.id, status: 'AGUARDANDO_APROVACAO', message: 'Ficha de EPI localizada. Solicitação encaminhada para aprovação pelo script de correção.' } })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
