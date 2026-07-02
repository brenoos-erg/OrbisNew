import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function argValue(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (direct) return direct.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const code = String(argValue('--code') ?? '').trim()
  const apply = process.argv.includes('--apply')
  const reason = String(argValue('--reason') ?? 'Correção retroativa: exclusão por erro de postagem.').trim()
  const inactiveById = String(argValue('--inactiveById') ?? '').trim() || undefined

  if (!code) {
    throw new Error('Informe o código. Exemplo: npm run documents:fix-deleted-code -- --code RQ.ENG.196')
  }

  const document = await prisma.isoDocument.findFirst({
    where: { code },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    include: {
      versions: { orderBy: [{ revisionNumber: 'desc' }, { createdAt: 'desc' }] },
      printCopies: { select: { id: true, status: true, copyNumber: true } },
    },
  })

  console.log(`Diagnóstico do código: ${code}`)
  if (!document) {
    console.log('- Documento não encontrado.')
    console.log('- code-availability: cadastro novo, isRevision=false.')
    return
  }

  const latest = document.versions[0]
  const isCanceled = latest?.status === 'CANCELADO'
  const looksInactive = !document.isActive || Boolean(document.inactiveAt)

  console.log(`- Documento: ${document.id}`)
  console.log(`- Ativo: ${document.isActive}`)
  console.log(`- Inativado em: ${document.inactiveAt?.toISOString() ?? '-'}`)
  console.log(`- Motivo de inativação: ${document.inactiveReason ?? '-'}`)
  console.log(`- Versões: ${document.versions.map((version) => `rev ${version.revisionNumber} / ${version.status}`).join(', ') || '-'}`)
  console.log(`- Última revisão: ${latest?.revisionNumber ?? '-'}`)
  console.log(`- Está CANCELADO: ${isCanceled ? 'sim' : 'não'}`)
  console.log(`- Cópias impressas: ${document.printCopies.length}`)
  console.log(`- code-availability atual trataria como revisão: ${latest ? 'sim' : 'não'}`)

  if (!apply) {
    console.log('\nModo diagnóstico. Use --apply para marcar exclusão lógica por erro de postagem e liberar o código.')
    return
  }

  if (!isCanceled && !looksInactive) {
    throw new Error('Por segurança, --apply só atua em documento cancelado ou inativo. Cancele formalmente ou revise o caso antes.')
  }

  if (document.printCopies.length > 0) {
    throw new Error('Documento possui cópias impressas. Use cancelamento formal para preservar rastreabilidade.')
  }

  await prisma.isoDocument.update({
    where: { id: document.id },
    data: {
      isActive: false,
      activeCode: null,
      inactiveAt: new Date(),
      inactiveById,
      inactiveReason: reason.includes('POSTING_ERROR') ? reason : `POSTING_ERROR: ${reason}`,
    },
  })
  console.log(`Aplicado: documento ${code} marcado como excluído por erro de postagem. Código liberado para cadastro na mesma revisão.`)
  console.log(`Motivo informado: ${reason}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
