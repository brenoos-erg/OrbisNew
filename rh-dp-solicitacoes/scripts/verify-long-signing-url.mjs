import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

loadEnv()
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://orbis:orbis123@localhost:3306/orbis'
}

const prisma = new PrismaClient()

function buildLongValue(label, size = 1200) {
  return `https://example.docusign.com/${label}?token=${'x'.repeat(size)}`
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
      pdfUrl: buildLongValue(`document-${suffix}`),
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

  const signingUrl = buildLongValue('recipient-view')
  const signingReturnUrl = buildLongValue('return')
  const auditTrailUrl = buildLongValue('audit-trail')
  const signingExternalId = `env-${'a'.repeat(1100)}-${suffix}`

  await prisma.documentAssignment.update({
    where: { id: assignment.id },
    data: {
      signingProvider: 'DOCUSIGN',
      signingUrl,
      signingReturnUrl,
      auditTrailUrl,
      signingExternalId,
    },
  })

  const stored = await prisma.documentAssignment.findUniqueOrThrow({
    where: { id: assignment.id },
    select: {
      signingUrl: true,
      signingReturnUrl: true,
      auditTrailUrl: true,
      signingExternalId: true,
      document: { select: { pdfUrl: true } },
    },
  })

  if (
    stored.signingUrl !== signingUrl ||
    stored.signingReturnUrl !== signingReturnUrl ||
    stored.auditTrailUrl !== auditTrailUrl ||
    stored.signingExternalId !== signingExternalId ||
    stored.document.pdfUrl !== document.pdfUrl
  ) {
    throw new Error('Campos de URL longos não foram persistidos corretamente.')
  }

  console.log('OK: URLs/IDs longos (>1000 chars) persistidos com sucesso em Document e DocumentAssignment.')


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