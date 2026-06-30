import { PrismaClient } from '@prisma/client'
import { normalizeStoredAttachmentUrl, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { isEpiUniformeReadyToForwardApproval } from '@/lib/epiUniformeFlow'
import { resolveTipoApproverId } from '@/lib/solicitationTipoApprovers'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}
const protocols = (readArg('protocols') || readArg('protocol') || '').split(',').map((item) => item.trim()).filter(Boolean)

async function main() {
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
    include: { tipo: true, department: { select: { code: true } }, anexos: true },
  })

  for (const solicitation of solicitations.filter((item) => isSolicitacaoEpiUniforme(item.tipo))) {
    const hasExistingAttachment = (await Promise.all(solicitation.anexos.map((attachment) => resolveExistingAttachmentPath(attachment.url)))).some(Boolean)
    if (!hasExistingAttachment || !isEpiUniformeReadyToForwardApproval(solicitation)) continue
    const approverId = await resolveTipoApproverId(solicitation.tipoId)
    console.log(`${apply ? 'Encaminhando' : 'Simularia encaminhar'} ${solicitation.protocolo} para aprovação. approverId=${approverId ?? '-'}`)
    if (apply && approverId) {
      await prisma.solicitation.update({ where: { id: solicitation.id }, data: { requiresApproval: true, approvalStatus: 'PENDENTE', approverId, status: 'AGUARDANDO_APROVACAO' } })
      await prisma.solicitationTimeline.create({ data: { solicitationId: solicitation.id, status: 'AGUARDANDO_APROVACAO', message: 'Ficha de EPI localizada. Solicitação encaminhada para aprovação pelo script de correção.' } })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
