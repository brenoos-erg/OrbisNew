type TipoSolicitacaoLike = {
  id?: string | null
  codigo?: string | null
  nome?: string | null
}
function normalizeSolicitacaoName(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export const SOLICITACAO_PESSOAL_MOTIVO_VAGA_VALUES = [
  'Aumento',
  'Substituição',
] as const

export type SolicitacaoPessoalMotivoVaga =
  (typeof SOLICITACAO_PESSOAL_MOTIVO_VAGA_VALUES)[number]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export function normalizeSolicitacaoPessoalMotivoVaga(
  value: unknown,
): SolicitacaoPessoalMotivoVaga | null {
  if (typeof value !== 'string') return null
  const normalized = normalizeText(value)

  if (normalized === 'AUMENTO' || normalized === 'AUMENTO DE QUADRO') {
    return 'Aumento'
  }
  if (normalized === 'SUBSTITUICAO') {
    return 'Substituição'
  }
  return null
}
export const AGENDAMENTO_FERIAS_TIPO_ID = 'AGENDAMENTO_DE_FERIAS'
export const AGENDAMENTO_FERIAS_TIPO_NOME = 'AGENDAMENTO DE FÉRIAS'
export const SOLICITACAO_EQUIPAMENTO_TIPO_ID = 'SOLICITACAO_EQUIPAMENTO'
export const SOLICITACAO_EQUIPAMENTO_TIPO_ID_ALT = 'RQ_089'
export const SOLICITACAO_EQUIPAMENTO_TIPO_NOME = 'SOLICITAÇÃO DE EQUIPAMENTO'
export const SOLICITACAO_EXAMES_SST_TIPO_ID = 'RQ_092'
export const SOLICITACAO_EPI_UNIFORME_TIPO_ID = 'RQ_043'
export const SOLICITACAO_INCENTIVO_EDUCACAO_TIPO_ID = 'RQ_091'
export const SOLICITACAO_INCENTIVO_EDUCACAO_CODIGO = 'RQ.RH.003'
export const SOLICITACAO_INCLUSAO_PLANO_DEPENDENTES_TIPO_ID = 'RQ_301'
export const SOLICITACAO_INCLUSAO_PLANO_DEPENDENTES_CODIGO = 'RQ.DP.008'

export type NadaConstaSetorKey =
  | 'DP'
  | 'TI'
  | 'ALMOX'
  | 'LOGISTICA'
  | 'SST'
  | 'SAUDE'
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
    label: 'Cancel. (E-mail, SGI, AD, Sapiens, MS, AUTODESK)',
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

export const NADA_CONSTA_SAUDE_FIELDS: NadaConstaCampoDef[] = [
  {
    name: 'saudeStatus',
    label: 'Acompanhamento',
    type: 'select',
    options: ['Ciente'],
    stage: 'saude',
    section: 'Saúde',
  },
]

export const NADA_CONSTA_SST_FIELDS: NadaConstaCampoDef[] = [
  {
    name: 'sstStatus',
    label: 'Acompanhamento',
    type: 'select',
    options: ['Ciente'],
    stage: 'sst',
    section: 'SST',
  },
]
export const NADA_CONSTA_FINANCEIRO_FIELDS: NadaConstaCampoDef[] = [
  {
    name: 'financeiroStatus',
    label: 'Status (Consta / Nada Consta)',
    type: 'select',
    options: ['Consta', 'Nada Consta'],
    stage: 'financeiro',
    section: 'Financeiro',
  },
  {
    name: 'financeiroObs',
    label: 'Obs.:',
    type: 'textarea',
    stage: 'financeiro',
    section: 'Financeiro',
  },
  {
    name: 'financeiroValorTotal',
    label: 'R$ (valor total)',
    type: 'number',
    stage: 'financeiro',
    section: 'Financeiro',
  },
]

export const NADA_CONSTA_FISCAL_FIELDS: NadaConstaCampoDef[] = [
  {
    name: 'fiscalStatus',
    label: 'Status (Consta / Nada Consta)',
    type: 'select',
    options: ['Consta', 'Nada Consta'],
    stage: 'fiscal',
    section: 'Fiscal',
  },
  {
    name: 'fiscalObs',
    label: 'Obs.:',
    type: 'textarea',
    stage: 'fiscal',
    section: 'Fiscal',
  },
  {
    name: 'fiscalValorTotal',
    label: 'R$ (valor total)',
    type: 'number',
    stage: 'fiscal',
    section: 'Fiscal',
  },
]

export function getNadaConstaDefaultFieldsForSetor(
  setor: NadaConstaSetorKey,
): NadaConstaCampoDef[] {
  if (setor === 'TI') return NADA_CONSTA_TI_FIELDS
  if (setor === 'SAUDE') return NADA_CONSTA_SAUDE_FIELDS
  if (setor === 'SST') return NADA_CONSTA_SST_FIELDS
  if (setor === 'FINANCEIRO') return NADA_CONSTA_FINANCEIRO_FIELDS
  if (setor === 'FISCAL') return NADA_CONSTA_FISCAL_FIELDS
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
    key: 'SAUDE',
    label: 'Saúde',
    stage: 'saude',
    constaField: 'saudeStatus',
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
  if (code === '21') pushUnique('SAUDE')

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
  if (
    normalized.includes('SAUDE') ||
    normalized.includes('MEDICINA') ||
    normalized.includes('OCUPACIONAL')
  ) {
    pushUnique('SAUDE')
  }
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
  return nome === normalizeSolicitacaoName(SOLICITACAO_EQUIPAMENTO_TIPO_NOME)
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

export function isSolicitacaoInclusaoPlanoDependentes(
  tipo?: TipoSolicitacaoLike | null,
) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === SOLICITACAO_INCLUSAO_PLANO_DEPENDENTES_TIPO_ID) return true
  const codigo = tipo.codigo?.trim().toUpperCase()
  return codigo === SOLICITACAO_INCLUSAO_PLANO_DEPENDENTES_CODIGO
}

export function isSolicitacaoIncentivoEducacao(
  tipo?: TipoSolicitacaoLike | null,
) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === SOLICITACAO_INCENTIVO_EDUCACAO_TIPO_ID) return true
  const codigo = tipo.codigo?.trim().toUpperCase()
  if (codigo === SOLICITACAO_INCENTIVO_EDUCACAO_CODIGO) return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('INCENTIVO A EDUCACAO')
}


export function isSolicitacaoPessoal(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_247') return false
  if (id === 'RQ_063') return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  if (nome.includes('DESLIGAMENTO')) return false
  return nome.includes('RQ_063') || nome.includes('RQ.063') || nome.includes('SOLICITACAO DE PESSOAL')
}
export function isSolicitacaoAdmissao(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'SOLICITACAO_ADMISSAO') return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('SOLICITACAO DE ADMISSAO')
}


export function isSolicitacaoVeiculos(tipo?: TipoSolicitacaoLike | null) {
  if (!tipo) return false
  const id = tipo.id?.trim().toUpperCase()
  if (id === 'RQ_088') return true
  const nome = normalizeSolicitacaoName(tipo.nome)
  return nome.includes('RQ.088') || nome.includes('RQ_088') || nome.includes('SOLICITACAO DE VEICULO')}
