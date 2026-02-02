type TipoSolicitacaoLike = {
  id?: string | null
  nome?: string | null
}
export const AGENDAMENTO_FERIAS_TIPO_ID = 'AGENDAMENTO_DE_FERIAS'
export const AGENDAMENTO_FERIAS_TIPO_NOME = 'AGENDAMENTO DE FÉRIAS'

export type NadaConstaSetorKey =
  | 'DP'
  | 'TI'
  | 'ALMOX'
  | 'LOGISTICA'
  | 'SST'
  | 'FINANCEIRO'
  | 'FISCAL'
export type NadaConstaCampoDef = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  stage: string
  section: string
}

export const NADA_CONSTA_TI_FIELDS: NadaConstaCampoDef[] = [
  {
    name: 'tiStatus',
    label: 'Status (Consta / Nada Consta)',
    type: 'select',
    options: ['Consta', 'Nada Consta'],
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
  {
    name: 'tiCancelamentos',
    label: 'Cancel. (E-mail, Geartech, BITRIX, AD, Sapiens, MS, AUTODESK)',
    type: 'select',
    options: ['Sim', 'Não', 'Não Aplicável'],
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
  {
    name: 'tiDevolucaoCelular',
    label: 'Devolução Celular corporativo',
    type: 'select',
    options: ['Entregue', 'Não Entregue', 'Não Aplicável'],
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
  {
    name: 'tiDevolucaoNotebook',
    label: 'Devolução Notebook da empresa',
    type: 'select',
    options: ['Entregue', 'Não Entregue', 'Não Aplicável'],
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
  {
    name: 'tiObs',
    label: 'Obs. (situação dos equipamentos, patrimônio, etc)',
    type: 'textarea',
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
  {
    name: 'tiValorTotal',
    label: 'R$ (valor total)',
    type: 'number',
    stage: 'ti',
    section: 'Tecnologia da Informação',
  },
]

export function getNadaConstaDefaultFieldsForSetor(
  setor: NadaConstaSetorKey,
): NadaConstaCampoDef[] {
  if (setor === 'TI') return NADA_CONSTA_TI_FIELDS
  return []
}

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

export function resolveNadaConstaSetorByDepartment(
  dept?: {
    code?: string | null
    name?: string | null
  } | null,
): NadaConstaSetorKey | null {
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

export function isSolicitacaoAgendamentoFerias(
  tipo?: TipoSolicitacaoLike | null,
) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === AGENDAMENTO_FERIAS_TIPO_ID) return true
  const nome = tipo.nome?.trim().toUpperCase() ?? ''
  return nome === AGENDAMENTO_FERIAS_TIPO_NOME
}