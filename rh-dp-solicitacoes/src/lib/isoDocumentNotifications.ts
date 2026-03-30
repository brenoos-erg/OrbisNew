import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'

export async function notifyDocumentPublished(versionId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: { document: { include: { ownerDepartment: true, author: true } } },
  })
  if (!version || !version.document) return { sent: false, reason: 'not-found' as const }

  const users = await prisma.user.findMany({
    where: {
      status: 'ATIVO',
      OR: [
        { departmentId: version.document.ownerDepartmentId },
        { costCenters: { some: {} } },
      ],
    },
    select: { email: true },
    take: 300,
  })

  const to = Array.from(new Set(users.map((user) => user.email).filter(Boolean)))
  if (to.length === 0) return { sent: false, reason: 'no-recipients' as const }

  const subject = `Documento publicado: ${version.document.code} (REV${String(version.revisionNumber).padStart(2, '0')})`
  const text = [
    'Um documento foi publicado no módulo de controle documental.',
    '',
    `Código: ${version.document.code}`,
    `Título: ${version.document.title}`,
    `Revisão: REV${String(version.revisionNumber).padStart(2, '0')}`,
    `Departamento: ${version.document.ownerDepartment.name}`,
    `Publicado em: ${version.publishedAt?.toLocaleString('pt-BR') ?? '-'}`,
  ].join('\n')

  const result = await sendMail({ to, subject, text }, 'ALERTS')
  return { sent: result.sent, reason: result.sent ? ('ok' as const) : ('mail-failed' as const) }
}
