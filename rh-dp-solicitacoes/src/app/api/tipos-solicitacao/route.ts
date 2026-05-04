export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXTERNAL_ADMISSION_TYPE_CODE, EXTERNAL_ADMISSION_TYPE_ID } from '@/lib/externalAdmission'

type CampoEspecifico = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  defaultValue?: string
  section?: string
  stage?: string
  visibleWhen?: {
    field: string
    equals?: string
    includes?: string
  }
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
  internalOnly?: boolean
  hiddenFromManualOpening?: boolean
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
  const normalizedLabel = (campo.label ?? '').toLowerCase()
  const isCostCenterField =
    campo.type === 'cost_center' ||
    normalizedName.includes('centrocusto') ||
    normalizedName.includes('costcenter') ||
    normalizedLabel.includes('centro de custo') ||
    normalizedLabel.includes('centro custo') ||
    normalizedLabel.includes('contrato (destino)')

  const autoFillFromMe = ['emailsolicitante', 'nomesolicitante', 'telefonesolicitante', 'departamentosolicitante', 'cargosolicitante'].some((token) => normalizedName.includes(token))

  return {
    ...campo,
    type: isCostCenterField ? 'cost_center' : campo.type,
    ...(autoFillFromMe ? { defaultValue: '' } : {}),
  }
}


const TI_EQUIPAMENTO_CODIGO = 'RQ.TI.003'
const TI_LEGACY_FIELDS = new Set(['tipoEquipamentoTi', 'configuracaoEquipamentoTi'])

const harmonizeTiEquipmentSchema = (tipoCodigo: string, campos: CampoEspecifico[]) => {
  if (tipoCodigo.toUpperCase() !== TI_EQUIPAMENTO_CODIGO) return campos

  const withoutLegacy = campos.filter((campo) => !TI_LEGACY_FIELDS.has(campo.name))
  const names = new Set(withoutLegacy.map((campo) => campo.name))

  const applyRule = (name: string, visibleWhen?: CampoEspecifico['visibleWhen']) => {
    const idx = withoutLegacy.findIndex((campo) => campo.name === name)
    if (idx === -1) return
    withoutLegacy[idx] = { ...withoutLegacy[idx], ...(visibleWhen ? { visibleWhen } : {}) }
  }

  applyRule('descricaoEquipamentoOutro', { field: 'equipamentoSolicitado', equals: 'Outro' })
  applyRule('descricaoPeriferico', { field: 'equipamentoSolicitado', equals: 'Periféricos' })

  const notebookFields = ['precisaMochila','precisaMouse','precisaTeclado','precisaHeadset','precisaAdaptador','precisaCarregadorFonte','precisaOutroAcessorio']
  notebookFields.forEach((fieldName) => applyRule(fieldName, { field: 'equipamentoSolicitado', equals: 'Notebook' }))
  applyRule('descricaoOutroAcessorio', { field: 'precisaOutroAcessorio', equals: 'true' })

  if (!names.has('equipamentoSolicitado')) {
    withoutLegacy.unshift({
      name: 'equipamentoSolicitado',
      label: 'Equipamento solicitado',
      type: 'select',
      required: true,
      options: ['Notebook', 'Desktop', 'Celular', 'Impressora', 'Periféricos', 'Outro'],
      stage: 'solicitante',
      section: 'Equipamento',
    })
  }

  return withoutLegacy
}
const shouldIncludeTipo = ({
  tipoId,
  tipoCodigo,
  schema,
  centroCustoId,
  departamentoId,
}: {
  tipoId: string
  tipoCodigo: string
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

  const isTechnicalExternalAdmissionType =
    tipoCodigo === EXTERNAL_ADMISSION_TYPE_CODE || tipoId === EXTERNAL_ADMISSION_TYPE_ID

  if (isTechnicalExternalAdmissionType) return false

  const hiddenFromManualOpening =
    schema?.meta?.hiddenFromCreate === true ||
    schema?.meta?.internalOnly === true ||
    schema?.meta?.hiddenFromManualOpening === true

  return centroPermitido && departamentoPermitido && !hiddenFromManualOpening
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
      orderBy: [
        {
          codigo: 'asc',
        },
        {
          nome: 'asc',
        },
      ],
    })
     const resposta = tipos
      .filter((tipo) =>
        shouldIncludeTipo({
          tipoId: tipo.id,
          tipoCodigo: tipo.codigo,
          schema: tipo.schemaJson as SchemaJson,
          centroCustoId,
          departamentoId,
        }),
      )
      .map((tipo) => {
        const schema = tipo.schemaJson as SchemaJson
        let campos = harmonizeTiEquipmentSchema(tipo.codigo, (schema?.camposEspecificos ?? schema?.campos ?? []).map(normalizeCampo))
        const isAgendamentoFerias = tipo.id === 'AGENDAMENTO_DE_FERIAS'

        if (isAgendamentoFerias) {
          campos = campos
            .filter((campo) => !['anexosSolicitacao', 'anexosSolicitante'].includes(campo.name))
            .map((campo) => {
              if (campo.name === 'abonoPecuniarioSim') return { ...campo, label: 'Abono' }
              if (campo.name === 'pagamentoAbonoQuando') {
                return {
                  ...campo,
                  options: (campo.options ?? []).filter((option) => option !== 'Na folha do mês'),
                }
              }
              return campo
            })
        }

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
