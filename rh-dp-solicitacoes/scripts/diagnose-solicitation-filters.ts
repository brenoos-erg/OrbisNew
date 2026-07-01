import { prisma } from '../src/lib/prisma'
import { parseSolicitationListFilters, buildBaseWhereFromFilters } from '../src/lib/solicitationListFilters'

function arg(name: string) {
  const prefix = `--${name}=`
  const inline = process.argv.find((item) => item.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const params = new URLSearchParams()
  const q = arg('q')
  const protocol = arg('protocol')
  const scope = arg('scope') ?? 'received'
  if (q) params.set('q', q)
  if (protocol) params.set('q', protocol)
  params.set('scope', scope)
  const filters = parseSolicitationListFilters(params)
  const where = buildBaseWhereFromFilters(filters)
  const protocols = await prisma.solicitation.findMany({
    where: protocol ? { protocolo: protocol } : where,
    take: 20,
    orderBy: { dataAbertura: 'desc' },
    select: { protocolo: true, status: true, tipoId: true, departmentId: true, costCenterId: true },
  })
  console.log(JSON.stringify({
    user: arg('user') ?? null,
    filters,
    where,
    totalBruto: protocols.length,
    totalPosFiltro: protocols.length,
    searchMode: 'shared-parser/search-index-or-memory-fallback',
    protocolosEncontrados: protocols,
    urlSugerida: protocol ? `/api/solicitacoes/diagnostico-filtro?protocol=${encodeURIComponent(protocol)}&scope=${scope}` : null,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
