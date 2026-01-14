import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  defaultValue?: string
}

type TipoMeta = {
  centros?: string[]        // ids do centro de custo permitidos
  departamentos?: string[]  // ids de departamentos permitidos
}

// Aceita tanto "camposEspecificos" quanto "campos" no JSON do banco
type SchemaJson = {
  meta?: TipoMeta
  camposEspecificos?: CampoEspecifico[]
  campos?: CampoEspecifico[]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const centroCustoId = searchParams.get('centroCustoId')
    const departamentoId = searchParams.get('departamentoId')

    // 1) Carrega os tipos filtrando direto no banco (JSONB)
    const tipos = await prisma.$queryRaw<
      {
        id: string
        nome: string
        descricao: string | null
        schemaJson: SchemaJson | null
      }[]
    >(Prisma.sql`
      SELECT *
      FROM "TipoSolicitacao"
      WHERE (
        ${centroCustoId}::text IS NULL
        OR ("schemaJson"->'meta'->'centros') IS NULL
         OR jsonb_typeof(("schemaJson"->'meta'->'centros')) <> 'array'
        OR jsonb_array_length(("schemaJson"->'meta'->'centros')) = 0
        OR ("schemaJson"->'meta'->'centros') ? ${centroCustoId}
      )
      AND (
        ${departamentoId}::text IS NULL
        OR ("schemaJson"->'meta'->'departamentos') IS NULL
        OR jsonb_typeof(("schemaJson"->'meta'->'departamentos')) <> 'array'
        OR jsonb_array_length(("schemaJson"->'meta'->'departamentos')) = 0
        OR ("schemaJson"->'meta'->'departamentos') ? ${departamentoId}
      )
    `)

    // 2) Resposta limpa para o frontend
    const resposta = tipos.map((tipo) => {
      const schema = tipo.schemaJson

      const campos = schema?.camposEspecificos ?? schema?.campos ?? []

      return {
        id: tipo.id,
        nome: tipo.nome,
        descricao: tipo.descricao ?? undefined,
        camposEspecificos: campos,
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
