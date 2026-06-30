import { PrismaClient } from '@prisma/client'
import { normalizeStoredAttachmentUrl, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { isEpiUniformeApprovalPending, isEpiUniformeReadyToForwardApproval, isEpiUniformeWaitingFicha } from '@/lib/epiUniformeFlow'

const prisma = new PrismaClient()

function readArg(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  if (direct) return direct.split('=').slice(1).join('=')
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ''
}

const protocols = (readArg('protocols') || readArg('protocol') || process.argv.slice(2).filter((arg) => !arg.startsWith('--')).join(','))
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

function approvalMissingReason(solicitation: any) {
  if (!solicitation) return 'Solicitação não encontrada.'
  if (!isSolicitacaoEpiUniforme(solicitation.tipo)) return 'Não é RQ.SST.043/Requisição de EPI.'
  if (isEpiUniformeApprovalPending(solicitation)) return 'Aparece em Aprovações se o usuário for aprovador autorizado.'
  if (isEpiUniformeWaitingFicha(solicitation)) return 'Aguardando SST anexar Ficha de EPI para encaminhar à aprovação.'
  if (isEpiUniformeReadyToForwardApproval(solicitation)) return 'Possui anexo, mas ainda precisa encaminhar para aprovação.'
  if (['APROVADO', 'REPROVADO'].includes(String(solicitation.approvalStatus))) return 'A aprovação já foi concluída.'
  return 'Verificar requiresApproval, approvalStatus, departamento atual e aprovador configurado.'
}

async function main() {
  if (protocols.length === 0) throw new Error('Informe --protocol RQ2026-xxxxx ou --protocols RQ1,RQ2.')

  for (const protocolo of protocols) {
    const solicitation = await prisma.solicitation.findUnique({
      where: { protocolo },
      include: {
        tipo: true,
        department: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, description: true } },
        anexos: { orderBy: { createdAt: 'asc' } },
      },
    })

    console.log(`\n${protocolo}`)
    if (!solicitation) {
      console.log('  - encontrado: não')
      continue
    }

    console.log(`  - tipo: ${solicitation.tipo?.id} / ${solicitation.tipo?.codigo ?? '-'} / ${solicitation.tipo?.nome ?? '-'}`)
    console.log(`  - status: ${solicitation.status}`)
    console.log(`  - requiresApproval: ${solicitation.requiresApproval}`)
    console.log(`  - approvalStatus: ${solicitation.approvalStatus}`)
    console.log(`  - approverId: ${solicitation.approverId ?? '-'}`)
    console.log(`  - departamento atual: ${solicitation.department?.code ?? '-'} / ${solicitation.department?.name ?? '-'}`)
    console.log(`  - centro atual: ${solicitation.costCenter?.code ?? '-'} / ${solicitation.costCenter?.description ?? '-'}`)
    console.log(`  - aparece em Recebidas?: ${solicitation.status !== 'CANCELADA' && solicitation.status !== 'CONCLUIDA' ? 'sim' : 'não'}`)
    console.log(`  - aparece em Aprovações?: ${isEpiUniformeApprovalPending(solicitation) ? 'sim' : 'não'}`)
    console.log(`  - motivo de não aparecer em Aprovações: ${approvalMissingReason(solicitation)}`)
    console.log(`  - ação recomendada: ${isEpiUniformeReadyToForwardApproval(solicitation) ? 'Rodar fix com --apply ou reenviar anexo para encaminhar.' : isEpiUniformeWaitingFicha(solicitation) ? 'Anexar Ficha de EPI pelo SST.' : 'Conferir aprovadores e status.'}`)
    for (const attachment of solicitation.anexos) {
      const normalizedUrl = normalizeStoredAttachmentUrl(attachment.url)
      const resolved = await resolveExistingAttachmentPath(attachment.url)
      console.log(`  - anexo: ${attachment.filename} | url=${attachment.url} | normalizada=${normalizedUrl ?? '-'} | físico=${resolved ? 'existe' : 'não existe'}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
