import { prisma } from '@/lib/prisma'
import { normalizeStoredAttachmentUrl, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { canUserSeeEpiUniformeApproval, isEpiUniformeApprovalPending, isEpiUniformeReadyToForwardApproval, isEpiUniformeWaitingFicha } from '@/lib/epiUniformeFlow'
import { buildReceivedWhereByPolicy, resolveUserAccessContext } from '@/lib/solicitationAccessPolicy'


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
const userEmail = readArg('user-email') || readArg('email')
const since = readArg('since')
const tipoArg = readArg('tipo')

type DiagnosisUser = Awaited<ReturnType<typeof resolveDiagnosisUser>>

function tipoMatchesArg(solicitation: any, tipo: string) {
  if (!tipo) return true
  const expected = tipo.trim().toUpperCase()
  const aliases = expected === 'RQ.SST.043' ? ['RQ.SST.043', 'RQ_043', 'RQ.043', 'REQUISICAO DE EPI', 'REQUISIÇÃO DE EPI'] : [expected]
  const values = [solicitation.tipoId, solicitation.tipo?.id, solicitation.tipo?.codigo, solicitation.tipo?.nome]
    .filter(Boolean)
    .map((value) => String(value).toUpperCase())
  return aliases.some((alias) => values.some((value) => value.includes(alias)))
}

function approvalMissingReason(solicitation: any, user?: NonNullable<DiagnosisUser>) {
  if (!solicitation) return 'Solicitação não encontrada.'
  if (!isSolicitacaoEpiUniforme(solicitation.tipo)) return 'Não é RQ.SST.043/Requisição de EPI.'
  if (isEpiUniformeApprovalPending(solicitation)) {
    if (!user) return 'Aparece em Aprovações se o usuário for aprovador autorizado.'
    if (solicitation.approverId === user.id) return 'Aparece em Aprovações para Gabriela por approverId direto.'
    return `Não aparece em Aprovações para Gabriela: approverId aponta para ${solicitation.approverId ?? 'ninguém'}, não para ${user.id}.`
  }
  if (isEpiUniformeWaitingFicha(solicitation)) return 'Aguardando SST anexar Ficha de EPI para encaminhar à aprovação.'
  if (isEpiUniformeReadyToForwardApproval(solicitation)) return 'Possui anexo, mas ainda precisa encaminhar para aprovação.'
  if (['APROVADO', 'REPROVADO'].includes(String(solicitation.approvalStatus))) return 'A aprovação já foi concluída.'
  if (solicitation.department?.code !== '19') return `Departamento atual é ${solicitation.department?.code ?? '-'}, não 19 - Segurança do Trabalho.`
  if (solicitation.requiresApproval !== true) return 'requiresApproval=false; não entra na fila de Aprovação.'
  if (solicitation.approvalStatus !== 'PENDENTE') return `approvalStatus=${solicitation.approvalStatus}; esperado PENDENTE para Aprovação.`
  if (!solicitation.approverId) return 'approverId vazio; não há aprovador direto.'
  return 'Verificar requiresApproval, approvalStatus, departamento atual e aprovador configurado.'
}

function recommendedAction(solicitation: any) {
  if (isEpiUniformeReadyToForwardApproval(solicitation)) return 'Rodar fix com --apply ou reenviar anexo para encaminhar.'
  if (isEpiUniformeWaitingFicha(solicitation)) return 'Anexar Ficha de EPI pelo SST.'
  if (solicitation.department?.code === '19' && solicitation.requiresApproval === true && solicitation.approvalStatus === 'PENDENTE' && !solicitation.approverId) return 'Configurar aprovador da RQ.SST.043 e rodar script de correção.'
  if (solicitation.department?.code !== '19') return 'Reencaminhar a solicitação para o departamento 19 - Segurança do Trabalho, se esta for a etapa esperada.'
  return 'Conferir aprovadores, status e regras de visibilidade.'
}

async function resolveDiagnosisUser() {
  if (!userEmail) return null
  return prisma.user.findFirst({
    where: { OR: [{ email: userEmail }, { login: userEmail }] },
    include: { department: true, costCenter: true },
  })
}

async function resolveDiagnosisAccessContext(user: NonNullable<DiagnosisUser>) {
  return resolveUserAccessContext({
    userId: user.id,
    userLogin: user.login,
    userEmail: user.email,
    userFullName: user.fullName,
    role: user.role,
    primaryDepartmentId: user.departmentId,
    primaryDepartment: user.department,
  })
}

async function appearsInReceivedForUser(solicitationId: string, userContext: Awaited<ReturnType<typeof resolveDiagnosisAccessContext>>) {
  const where = buildReceivedWhereByPolicy(userContext, { id: solicitationId }, { excludePendingRq063: true })
  return (await prisma.solicitation.count({ where })) > 0
}

async function printSolicitation(solicitation: any, user: DiagnosisUser, userContext: Awaited<ReturnType<typeof resolveDiagnosisAccessContext>> | null) {
  const received = userContext ? await appearsInReceivedForUser(solicitation.id, userContext) : solicitation.status !== 'CANCELADA' && solicitation.status !== 'CONCLUIDA'
  const approval = userContext ? canUserSeeEpiUniformeApproval(solicitation, userContext) : isEpiUniformeApprovalPending(solicitation)
  console.log(`\n${solicitation.protocolo}`)
  console.log(`  - tipo/código: ${solicitation.tipo?.id} / ${solicitation.tipo?.codigo ?? '-'} / ${solicitation.tipo?.nome ?? '-'}`)
  console.log(`  - solicitante: ${solicitation.solicitante?.fullName ?? '-'} (${solicitation.solicitante?.login ?? solicitation.solicitante?.email ?? '-'})`)
  console.log(`  - status: ${solicitation.status}`)
  console.log(`  - requiresApproval: ${solicitation.requiresApproval}`)
  console.log(`  - approvalStatus: ${solicitation.approvalStatus}`)
  console.log(`  - approverId: ${solicitation.approverId ?? '-'}`)
  console.log(`  - departamento atual: ${solicitation.department?.code ?? '-'} / ${solicitation.department?.name ?? '-'}`)
  console.log(`  - centro de custo atual: ${solicitation.costCenter?.code ?? '-'} / ${solicitation.costCenter?.description ?? '-'}`)
  const receivedLabel = user ? 'aparece em Recebidas para usuário?' : 'aparece em Recebidas?'
  const approvalLabel = user ? 'aparece em Aprovações para usuário?' : 'aparece em Aprovações?'
  console.log(`  - ${receivedLabel}: ${received ? 'sim' : 'não'}`)
  console.log(`  - ${approvalLabel}: ${approval ? 'sim' : 'não'}`)
  console.log(`  - motivo de não aparecer em Aprovações: ${approval ? 'Sem bloqueio na fila de Aprovações; conferir filtros de tela.' : approvalMissingReason(solicitation, user ?? undefined)}`)
  console.log(`  - motivo exato de não aparecer: ${received || approval ? 'Sem bloqueio na fila indicada; conferir filtros de tela.' : approvalMissingReason(solicitation, user ?? undefined)}`)
  console.log(`  - ação recomendada: ${recommendedAction(solicitation)}`)
  if (solicitation.anexos.length === 0) console.log('  - anexos existentes: nenhum')
  for (const attachment of solicitation.anexos) {
    const normalizedUrl = normalizeStoredAttachmentUrl(attachment.url)
    const resolved = await resolveExistingAttachmentPath(attachment.url)
    console.log(`  - anexo: ${attachment.filename} | url=${attachment.url} | normalizada=${normalizedUrl ?? '-'} | físico=${resolved ? 'existe' : 'não existe'}`)
  }
}

async function main() {
  const user = await resolveDiagnosisUser()
  if (userEmail && !user) throw new Error(`Usuário não encontrado para --user-email=${userEmail}.`)
  const userContext = user ? await resolveDiagnosisAccessContext(user) : null
  if (user) {
    console.log(`Usuário diagnóstico: ${user.fullName} | ${user.login ?? '-'} | ${user.email} | depto=${user.department?.code ?? '-'} ${user.department?.name ?? '-'} | centro=${user.costCenter?.code ?? '-'} ${user.costCenter?.description ?? '-'}`)
  }

  const where: any = protocols.length ? { protocolo: { in: protocols } } : {}
  if (since) where.dataAbertura = { gte: new Date(`${since}T00:00:00.000Z`) }
  if (!protocols.length && !since) throw new Error('Informe --protocol RQ2026-xxxxx, --protocols RQ1,RQ2 ou --since=YYYY-MM-DD.')

  const solicitations = await prisma.solicitation.findMany({
    where,
    include: {
      tipo: true,
      solicitante: { select: { fullName: true, login: true, email: true } },
      department: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, code: true, description: true } },
      anexos: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { dataAbertura: 'asc' },
  })

  const filtered = solicitations.filter((item) => isSolicitacaoEpiUniforme(item.tipo) && tipoMatchesArg(item, tipoArg || 'RQ.SST.043'))
  if (filtered.length === 0) console.log('\nNenhuma solicitação de EPI encontrada para os filtros informados.')
  for (const solicitation of filtered) await printSolicitation(solicitation, user, userContext)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => prisma.$disconnect())
