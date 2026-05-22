import { PrismaClient } from '@prisma/client'
import { NADA_CONSTA_SETORES } from '@/lib/solicitationTypes'

const prisma = new PrismaClient()
const REQUIRED = NADA_CONSTA_SETORES.map((item) => item.key)

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.solicitation.findMany({
    where: { tipo: { codigo: { in: ['RQ.RH.001', 'RQ.001'] } } },
    select: { id: true, protocolo: true, solicitacaoSetores: { select: { setor: true } } },
  })

  const inserts: { solicitacaoId: string; setor: string; status: 'PENDENTE' }[] = []
  for (const row of rows) {
    const existing = new Set(row.solicitacaoSetores.map((s) => s.setor))
    for (const setor of REQUIRED) {
      if (!existing.has(setor)) inserts.push({ solicitacaoId: row.id, setor, status: 'PENDENTE' })
    }
  }

  console.log(`Nada Consta: ${rows.length}`)
  console.log(`Linhas faltantes: ${inserts.length}`)
  if (!apply) {
    console.log('Dry-run. Use --apply para inserir.')
    return
  }
  if (inserts.length) {
    await prisma.solicitacaoSetor.createMany({ data: inserts, skipDuplicates: true })
  }
  console.log('Backfill concluído.')
}

main().finally(async () => prisma.$disconnect())
