type TipoSolicitacaoLike = {
  id?: string | null
  nome?: string | null
}
function normalizeSolicitacaoName(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}
export const AGENDAMENTO_FERIAS_TIPO_ID = 'AGENDAMENTO_DE_FERIAS'
export const AGENDAMENTO_FERIAS_TIPO_NOME = 'AGENDAMENTO DE FÉRIAS'
export const SOLICITACAO_EQUIPAMENTO_TIPO_ID = 'SOLICITACAO_EQUIPAMENTO'
export const SOLICITACAO_EQUIPAMENTO_TIPO_ID_ALT = 'RQ_089'
export const SOLICITACAO_EQUIPAMENTO_TIPO_NOME = 'SOLICITAÇÃO DE EQUIPAMENTO'
export const SOLICITACAO_EXAMES_SST_TIPO_ID = 'RQ_092'
export const SOLICITACAO_EPI_UNIFORME_TIPO_ID = 'RQ_043'

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

export function resolveNadaConstaSetoresByDepartment(
  dept?: {
    code?: string | null
    name?: string | null
  } | null,
): NadaConstaSetorKey[] {
  if (!dept) return []
  const resolved: NadaConstaSetorKey[] = []
  const pushUnique = (value: NadaConstaSetorKey) => {
    if (!resolved.includes(value)) {
      resolved.push(value)
    }
  }

  const code = dept.code?.trim()
  if (code === '08') pushUnique('DP')
  if (code === '20') pushUnique('TI')
  if (code === '11') {
    pushUnique('LOGISTICA')
    pushUnique('ALMOX')
  }
  if (code === '10') pushUnique('FINANCEIRO')
  if (code === '06') pushUnique('FISCAL')
  if (code === '19') pushUnique('SST')

  const normalized =
    dept.name
      ?.toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase() ?? ''

  if (normalized.includes('PESSOAL')) pushUnique('DP')
  if (normalized.includes('TECNOLOGIA') || normalized.includes('INFORMACAO'))
    pushUnique('TI')
  if (normalized.includes('ALMOX')) pushUnique('ALMOX')
  if (normalized.includes('LOGISTICA')) {
    pushUnique('LOGISTICA')
    pushUnique('ALMOX')
  }
  if (normalized.includes('SST') || normalized.includes('SEGURANCA'))
    pushUnique('SST')
  if (normalized.includes('FINANCEIRO')) pushUnique('FINANCEIRO')
  if (normalized.includes('FISCAL') || normalized.includes('CONTABIL'))
    pushUnique('FISCAL')
  return resolved
}

export function resolveNadaConstaSetorByDepartment(
  dept?: {
    code?: string | null
    name?: string | null
  } | null,
): NadaConstaSetorKey | null {
  return resolveNadaConstaSetoresByDepartment(dept)[0] ?? null
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
 const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('FERIAS')
}

export function isSolicitacaoEquipamento(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === SOLICITACAO_EQUIPAMENTO_TIPO_ID || id === SOLICITACAO_EQUIPAMENTO_TIPO_ID_ALT) return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('SOLICITACAO DE EQUIPAMENTO')
}

export function isSolicitacaoExamesSst(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === SOLICITACAO_EXAMES_SST_TIPO_ID) return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('RQ.092') || nome.includes('RQ_092') || nome.includes('SOLICITACAO DE EXAMES')
}
export function isSolicitacaoEpiUniforme(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === SOLICITACAO_EPI_UNIFORME_TIPO_ID) return true
   const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('RQ.043') || nome.includes('RQ_043') || nome.includes('REQUISICAO DE EPI')
}

export function isSolicitacaoPessoal(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_063') return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('RQ_063') || nome.includes('RQ.063') || nome.includes('SOLICITACAO DE PESSOAL')
}

export function isSolicitacaoVeiculos(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_088') return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('RQ.088') || nome.includes('RQ_088') || nome.includes('SOLICITACAO DE VEICULO')}
