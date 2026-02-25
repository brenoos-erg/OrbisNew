import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'

type TipoInput = {
  nome: string
  categoria: string
  centroResponsavelLabel: string
  slaTexto: string
  prioridadeTexto: string
}

const tiposFase1: TipoInput[] = [
  // Cole aqui os itens no formato:
  // { nome: 'Nome do tipo', categoria: 'Categoria', centroResponsavelLabel: 'Centro Responsável', slaTexto: '2 - DIAS', prioridadeTexto: 'MEDIA' },
]

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const parseSlaHours = (value: string) => {
  const match = value.match(/(\d+)\s*-\s*(DIAS|HORAS)/i)
  if (!match) {
    console.warn(`[import-tipos-fase1] SLA inválido: "${value}". Usando 0 horas.`)
    return 0
  }

  const amount = Number(match[1])
  const unit = match[2].toUpperCase()

  return unit === 'DIAS' ? amount * 24 : amount
}

const parsePrioridade = (value: string): Prioridade => {
  const normalized = normalizeText(value).toUpperCase()
  switch (normalized) {
    case 'BAIXA':
      return 'BAIXA'
    case 'MEDIA':
      return 'MEDIA'
    case 'ALTA':
      return 'ALTA'
    case 'URGENTE':
      return 'URGENTE'
    default:
      console.warn(
        `[import-tipos-fase1] Prioridade inválida: "${value}". Usando MEDIA.`,
      )
      return 'MEDIA'
  }
}

async function main() {
  const departamentos = await prisma.department.findMany({
    select: { id: true, name: true },
  })

  const departamentoMap = new Map(
    departamentos.map((department) => [normalizeText(department.name), department]),
  )

  for (const item of tiposFase1) {
    const nome = item.nome.trim()
    const categoria = item.categoria.trim()
    const centroResponsavelLabel = item.centroResponsavelLabel.trim()
    const slaHoras = parseSlaHours(item.slaTexto)
    const prioridade = parsePrioridade(item.prioridadeTexto)

    const departamentoMatch = departamentoMap.get(normalizeText(centroResponsavelLabel))
    const departamentosIds = departamentoMatch ? [departamentoMatch.id] : []

    if (!departamentoMatch) {
      console.warn(
        `[import-tipos-fase1] Departamento não encontrado para "${centroResponsavelLabel}". Usando wildcard.`,
      )
    }

    const schemaJson = {
      meta: {
        categoria,
        centroResponsavelLabel,
        defaultSlaHours: slaHoras,
        defaultPrioridade: prioridade,
        departamentos: departamentosIds,
      },
      camposEspecificos: [],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome },
      create: {
        id: randomUUID(),
        codigo: `RQ.EXT.${randomUUID().slice(0, 8).toUpperCase()}`,
        nome,
        descricao: `Categoria: ${categoria}`,
        schemaJson,
        updatedAt: new Date(),
      },
      update: {
        descricao: `Categoria: ${categoria}`,
        schemaJson,
        updatedAt: new Date(),
      },
    })


    console.info(`[import-tipos-fase1] Tipo upserted: ${nome}`)
  }
}

main()
  .catch((error) => {
    console.error('[import-tipos-fase1] Falha ao importar tipos:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })