import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

type TipoMeta = {
  centros?: string[]        // ids do centro de custo
  departamentos?: string[]  // ids ou códigos do departamento
}

type SchemaJson = {
  meta?: TipoMeta
  camposEspecificos?: CampoEspecifico[]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const centroCustoId = searchParams.get('centroCustoId') || undefined
    const departamentoId = searchParams.get('departamentoId') || undefined

    // 1) Carrega todos os tipos do banco
    const tipos = await prisma.tipoSolicitacao.findMany()

    // 2) Filtra usando meta.centros e meta.departamentos
    const filtrados = tipos.filter((tipo) => {
      const schema = tipo.schemaJson as SchemaJson | null
      const meta = schema?.meta

      const allowedCentros = meta?.centros
      const allowedDepartamentos = meta?.departamentos

      // filtra por centro de custo
      if (centroCustoId && allowedCentros && !allowedCentros.includes(centroCustoId)) {
        return false
      }

      // filtra por departamento
      if (departamentoId && allowedDepartamentos && !allowedDepartamentos.includes(departamentoId)) {
        return false
      }

      return true
    })

    // 3) Resposta limpa para o frontend
    const resposta = filtrados.map((tipo) => {
      const schema = tipo.schemaJson as SchemaJson | null
      return {
        id: tipo.id,
        nome: tipo.nome,
        descricao: tipo.descricao,
        camposEspecificos: schema?.camposEspecificos ?? []
      }
    })

    return NextResponse.json(resposta)

  } catch (error) {
    console.error('Erro em GET /api/tipos-solicitacao:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar tipos de solicitação' },
      { status: 500 }
    )
  }
}
