export const EXPERIENCE_EVALUATOR_GROUP_NAME = 'COORDENADORES_AVALIACAO_EXPERIENCIA'
export const EXPERIENCE_EVALUATION_TIPO_ID = 'RQ_RH_103'
export const EXPERIENCE_EVALUATION_STATUS = 'AGUARDANDO_AVALIACAO_GESTOR' as const
export const EXPERIENCE_EVALUATION_REQUIRED_FIELDS = [
  'relacionamentoNota',
  'comunicacaoNota',
  'atitudeNota',
  'saudeSegurancaNota',
  'dominioTecnicoProcessosNota',
  'adaptacaoMudancaNota',
  'autogestaoGestaoPessoasNota',
  'comentarioFinal',
] as const