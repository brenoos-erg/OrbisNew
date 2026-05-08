const { PrismaClient } = require('@prisma/client')
const DEFAULT_MYSQL_DATABASE_URL = 'mysql://orbis:orbis123@localhost:3306/orbis'
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL || DEFAULT_MYSQL_DATABASE_URL })
const { buildSolicitationDetailPayload } = require('../src/lib/solicitationDetailPayload')

type ErrorRow = {
  protocolo: string | null
  id: string
  tipoId: string | null
  status: string | null
  erro: string
}

async function main() {
  const errors: ErrorRow[] = []
  const solicitations = await prisma.solicitation.findMany({ orderBy: { dataAbertura: 'asc' } })
  const experienceEvaluators: Array<{ id: string; fullName: string }> = []

  for (const item of solicitations) {
    try {
      const attachmentIds = [item.id, item.parentId].filter(Boolean) as string[]
      const [
        tipo,
        approver,
        assumidaPor,
        costCenter,
        department,
        nonConformity,
        comentarios,
        eventos,
        timelines,
        solicitacaoSetores,
        children,
        documents,
        attachments,
      ] = await Promise.all([
        item.tipoId ? prisma.tipoSolicitacao.findUnique({ where: { id: item.tipoId } }) : Promise.resolve(null),
        item.approverId ? prisma.user.findUnique({ where: { id: item.approverId }, select: { id: true, fullName: true } }) : Promise.resolve(null),
        item.assumidaPorId ? prisma.user.findUnique({ where: { id: item.assumidaPorId }, select: { id: true, fullName: true } }) : Promise.resolve(null),
        item.costCenterId ? prisma.costCenter.findUnique({ where: { id: item.costCenterId } }) : Promise.resolve(null),
        item.departmentId ? prisma.department.findUnique({ where: { id: item.departmentId }, select: { id: true, name: true, code: true } }) : Promise.resolve(null),
        item.nonConformityId ? prisma.nonConformity.findUnique({ where: { id: item.nonConformityId }, select: { id: true, numeroRnc: true, status: true } }) : Promise.resolve(null),
        prisma.comment.findMany({ where: { solicitationId: item.id }, include: { autor: { select: { id: true, fullName: true, email: true } } }, orderBy: { createdAt: 'asc' } }).catch(() => []),
        prisma.event.findMany({ where: { solicitationId: item.id }, orderBy: { createdAt: 'asc' } }).catch(() => []),
        prisma.solicitationTimeline.findMany({ where: { solicitationId: item.id }, orderBy: { createdAt: 'asc' } }).catch(() => []),
        prisma.solicitacaoSetor.findMany({ where: { solicitacaoId: item.id }, orderBy: { setor: 'asc' } }).catch(() => []),
        prisma.solicitation.findMany({ where: { parentId: item.id }, include: { tipo: { select: { nome: true } }, department: { select: { name: true } } }, orderBy: { dataAbertura: 'asc' } }).catch(() => []),
        prisma.document.findMany({ where: { solicitationId: item.id }, include: { assignments: true }, orderBy: { createdAt: 'desc' } }).catch(() => []),
        attachmentIds.length > 0 ? prisma.attachment.findMany({ where: { solicitationId: { in: attachmentIds } }, orderBy: { createdAt: 'asc' } }).catch(() => []) : Promise.resolve([]),
      ])

      buildSolicitationDetailPayload({
        item,
        tipo,
        approver,
        assumidaPor,
        costCenter,
        department,
        nonConformity,
        comentarios,
        eventos,
        timelines,
        solicitacaoSetores,
        children,
        documents,
        attachments,
        experienceEvaluators,
        permissions: {
          viewerOnly: false,
          canAssume: false,
          canEdit: false,
          canApprove: false,
          canFinalize: false,
          canCancel: false,
          canComment: false,
        },
      })
    } catch (error: any) {
      errors.push({
        protocolo: item.protocolo ?? null,
        id: item.id,
        tipoId: item.tipoId ?? null,
        status: item.status ?? null,
        erro: error?.stack ?? error?.message ?? String(error),
      })
    }
  }

  console.log('Diagnóstico de detalhes de solicitações')
  console.log(`Total analisadas: ${solicitations.length}`)
  console.log(`Total com erro: ${errors.length}`)

  if (errors.length > 0) {
    console.table(errors.map((error) => ({
      protocolo: error.protocolo,
      id: error.id,
      tipoId: error.tipoId,
      status: error.status,
      erro: error.erro.split('\n')[0],
    })))
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('Falha no diagnóstico de detalhes de solicitações:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
