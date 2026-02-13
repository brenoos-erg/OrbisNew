import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildLongUrl(label) {
  const longQuery = 'x'.repeat(512)
  return `https://example.docusign.com/${label}?token=${longQuery}`
}

async function main() {
  const suffix = randomUUID()
  const email = `long-url-${suffix}@example.com`

  const user = await prisma.user.create({
    data: {
      email,
      fullName: `Long URL Test ${suffix}`,
    },
  })

  const document = await prisma.document.create({
    data: {
      type: 'TERMO_RESPONSABILIDADE',
      title: `Documento teste ${suffix}`,
      pdfUrl: `https://storage.local/${suffix}.pdf`,
      createdById: user.id,
    },
  })

  const assignment = await prisma.documentAssignment.create({
    data: {
      documentId: document.id,
      userId: user.id,
      status: 'AGUARDANDO_ASSINATURA',
    },
  })

  const signingUrl = buildLongUrl('recipient-view')
  const signingReturnUrl = buildLongUrl('return')
  const auditTrailUrl = buildLongUrl('audit-trail')

  await prisma.documentAssignment.update({
    where: { id: assignment.id },
    data: {
      signingProvider: 'DOCUSIGN',
      signingUrl,
      signingReturnUrl,
      auditTrailUrl,
      signingExternalId: `env-${suffix}`,
    },
  })

  const stored = await prisma.documentAssignment.findUniqueOrThrow({
    where: { id: assignment.id },
    select: {
      signingUrl: true,
      signingReturnUrl: true,
      auditTrailUrl: true,
    },
  })

  if (
    stored.signingUrl !== signingUrl ||
    stored.signingReturnUrl !== signingReturnUrl ||
    stored.auditTrailUrl !== auditTrailUrl
  ) {
    throw new Error('URLs longas não foram persistidas corretamente.')
  }

  console.log('OK: URLs longas (>191 chars) persistidas com sucesso no DocumentAssignment.')

  await prisma.documentAssignment.delete({ where: { id: assignment.id } })
  await prisma.document.delete({ where: { id: document.id } })
  await prisma.user.delete({ where: { id: user.id } })
}

main()
  .catch((error) => {
    console.error('Falha ao verificar persistência de URL longa:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })