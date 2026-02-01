type TipoSolicitacaoLike = {
  id?: string | null
  nome?: string | null
}

export type NadaConstaSetorKey =
  | 'DP'
  | 'TI'
  | 'ALMOX'
  | 'LOGISTICA'
  | 'SST'
  | 'FINANCEIRO'
  | 'FISCAL'

export const NADA_CONSTA_SETORES: {
  key: NadaConstaSetorKey
  label: string
  stage: string
  constaField: string
}[] = [
  {
    key: 'DP',
    label: 'Departamento Pessoal',
    stage: 'dp',
    constaField: 'dpStatus',
  },
  {
    key: 'TI',
    label: 'Tecnologia da Informação',
    stage: 'ti',
    constaField: 'tiStatus',
  },
  {
    key: 'ALMOX',
    label: 'Almoxarifado',
    stage: 'almox',
    constaField: 'almoxStatus',
  },
  {
    key: 'LOGISTICA',
    label: 'Logística',
    stage: 'logistica',
    constaField: 'logStatus',
  },
  {
    key: 'SST',
    label: 'SST',
    stage: 'sst',
    constaField: 'sstStatus',
  },
  {
    key: 'FINANCEIRO',
    label: 'Financeiro',
    stage: 'financeiro',
    constaField: 'financeiroStatus',
  },
  {
    key: 'FISCAL',
    label: 'Fiscal',
    stage: 'fiscal',
    constaField: 'fiscalStatus',
  },
]

export const NADA_CONSTA_SETORES_KEYS = NADA_CONSTA_SETORES.map(
  (setor) => setor.key,
)

export function resolveNadaConstaSetorByDepartment(dept?: {
  code?: string | null
  name?: string | null
}): NadaConstaSetorKey | null {
  if (!dept) return null
  const code = dept.code?.trim()
  if (code === '08') return 'DP'
  if (code === '20') return 'TI'
  if (code === '11') return 'LOGISTICA'
  if (code === '10') return 'FINANCEIRO'
  if (code === '06') return 'FISCAL'
  if (code === '19') return 'SST'

  const normalized =
    dept.name
      ?.toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase() ?? ''

  if (normalized.includes('PESSOAL')) return 'DP'
  if (normalized.includes('TECNOLOGIA') || normalized.includes('INFORMACAO'))
    return 'TI'
  if (normalized.includes('ALMOX')) return 'ALMOX'
  if (normalized.includes('LOGISTICA')) return 'LOGISTICA'
  if (normalized.includes('SST') || normalized.includes('SEGURANCA'))
    return 'SST'
  if (normalized.includes('FINANCEIRO')) return 'FINANCEIRO'
  if (normalized.includes('FISCAL') || normalized.includes('CONTABIL'))
    return 'FISCAL'
  return null
}

export function isSolicitacaoDesligamento(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_247') return true
  const nome = tipo.nome?.trim().toUpperCase() ?? ''
  return nome.includes('DESLIGAMENTO')
}

export function isSolicitacaoNadaConsta(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_300') return true
  const nome = tipo.nome?.trim().toUpperCase() ?? ''
  return nome.includes('NADA CONSTA')
}