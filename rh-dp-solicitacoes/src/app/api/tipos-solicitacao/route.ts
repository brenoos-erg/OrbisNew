export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  section?: string
  stage?: string
}

type TipoDestino = {
  value: string
  label: string
}

type TipoMeta = {
  centros?: string[]
  departamentos?: string[]
  requiresApproval?: boolean
  prazoPadraoDias?: number
  templateDownload?: string
  requiresAttachment?: boolean
  hiddenFromCreate?: boolean
  destinos?: TipoDestino[]
}

type SchemaJson = {
  meta?: TipoMeta
  camposEspecificos?: CampoEspecifico[]
  campos?: CampoEspecifico[]
}
const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}


const normalizeCampo = (campo: CampoEspecifico): CampoEspecifico => {
  const normalizedName = campo.name.toLowerCase()
  const isCostCenterField =
    campo.type === 'cost_center' ||
    normalizedName.includes('centrocusto') ||
    normalizedName.includes('costcenter')

  const autoFillFromMe = ['emailsolicitante', 'nomesolicitante', 'telefonesolicitante', 'departamentosolicitante', 'cargosolicitante'].some((token) => normalizedName.includes(token))

  return {
    ...campo,
    type: isCostCenterField ? 'cost_center' : campo.type,
    ...(autoFillFromMe ? { defaultValue: '' } : {}),
  }
}

const shouldIncludeTipo = ({
  schema,
  centroCustoId,
  departamentoId,
}: {
  schema: SchemaJson | null
  centroCustoId: string | null
  departamentoId: string | null
}) => {
  const centrosPermitidos = asStringArray(schema?.meta?.centros)
  const departamentosPermitidos = asStringArray(schema?.meta?.departamentos)

  const centroPermitido =
    !centroCustoId ||
    centrosPermitidos.length === 0 ||
    centrosPermitidos.includes(centroCustoId)

  const departamentoPermitido =
    !departamentoId ||
    departamentosPermitidos.length === 0 ||
    departamentosPermitidos.includes(departamentoId)

  return centroPermitido && departamentoPermitido && schema?.meta?.hiddenFromCreate !== true
}
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const centroCustoId = searchParams.get('centroCustoId')
    const departamentoId = searchParams.get('departamentoId')

    
     const tipos = await prisma.tipoSolicitacao.findMany({
      where: {
        NOT: {
          codigo: {
            startsWith: 'RQ.LEG.',
          },
        },
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        descricao: true,
        schemaJson: true,
      },
      orderBy: {
        nome: 'asc',
      },
    })
    const resposta = tipos
      .filter((tipo) =>
        shouldIncludeTipo({
          schema: tipo.schemaJson as SchemaJson,
          centroCustoId,
          departamentoId,
        }),
      )
       .map((tipo) => {
        const schema = tipo.schemaJson as SchemaJson
        const campos = (schema?.camposEspecificos ?? schema?.campos ?? []).map(normalizeCampo)

        return {
          id: tipo.id,
          codigo: tipo.codigo,
          nome: tipo.nome,
          descricao: tipo.descricao ?? undefined,
          camposEspecificos: campos,
          meta: schema?.meta ?? {},
        }
      })

    return NextResponse.json(resposta)
  } catch (error) {
    console.error('Erro em GET /api/tipos-solicitacao:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar tipos de solicitação' },
      { status: 500 },
    )
  }
}
