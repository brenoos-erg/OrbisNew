export const EXPERIENCE_EVALUATION_INTRO_TEXT =
  '1 - Avalie o colaborador nas questões conforme legenda abaixo e utilize como parâmetro as competências mapeadas para seu cargo no Gesto.Com:'

export const EXPERIENCE_EVALUATION_SCORE_OPTIONS = [
  'INSUFICIENTE',
  'PARCIAL',
  'PLENA',
  'ACIMA DA MÉDIA',
] as const

export const EXPERIENCE_EVALUATION_QUESTIONS = [
  {
    field: 'relacionamentoNota',
    title: 'RELACIONAMENTO',
    description:
      'Relaciona-se bem com os colaboradores de forma igualitária, respeitando individualidades e cultivando parcerias. / Em cargos de gestão, o colaborador também deve ser exemplo, estimulando bom relacionamento interpessoal para sua equipe e cultivando parcerias com clientes e fornecedores.',
  },
  {
    field: 'comunicacaoNota',
    title: 'COMUNICAÇÃO',
    description:
      'Fala de forma adequada a cada situação e mostra-se aberto para dar e/ou receber feedbacks (retornos) sobre o desempenho. Equilibra a fala e a escuta, ouvindo de maneira desarmada.',
  },
  {
    field: 'atitudeNota',
    title: 'ATITUDE',
    description:
      'Proativo, antecipando-se às demandas e demonstrando pontualidade e assertividade no trabalho. / Em cargos de gestão, o colaborador também deve ter planejamento estratégico, sabendo classificar urgências, apresentando comprometimento com seus processos e assumindo responsabilidades.',
  },
  {
    field: 'saudeSegurancaNota',
    title: 'SAÚDE E SEGURANÇA',
    description:
      'Respeita as normas de saúde e segurança, não se expõe a riscos e conscientiza os outros a respeito de sua importância.',
  },
  {
    field: 'dominioTecnicoProcessosNota',
    title: 'DOMÍNIO TÉCNICO/ PROCESSOS',
    description:
      'Possui domínio técnico de suas atividades, apresentando boas entregas e com o mínimo possível de erros. / Em cargos de gestão, o colaborador também deve possuir habilidades de gerir os processos que conduz de maneira estratégica, cumprindo metas com a qualidade esperada, respeitando as normas e procedimentos e trazendo os resultados esperados.',
  },
  {
    field: 'adaptacaoMudancaNota',
    title: 'ADAPTAÇÃO, MOBILIZAÇÃO E GESTÃO DA MUDANÇA',
    description:
      'Consegue se adaptar às mudanças e não demonstra resistências. / Em cargos de gestão, o colaborador também deve apresentar habilidades de conduzir sua equipe e recursos a um novo fim com assertividade, apresentando os benefícios dessa e demonstrando segurança/confiança para sua equipe.',
  },
  {
    field: 'autogestaoGestaoPessoasNota',
    title: 'AUTOGESTÃO/ GESTÃO DE PESSOAS',
    description:
      'Consegue realizar suas atividades de forma autônoma, quando necessário, demonstrando foco e planejamento, entregando suas atividades sem atrasos e buscando autodesenvolvimento. / Em cargos de gestão, também deve apresentar habilidades de conduzir sua equipe para alcançar objetivos, estabelecendo metas, potencializando talentos e trabalhando pontos negativos.',
  },
] as const

export const EXPERIENCE_EVALUATION_COMMENT_QUESTION = {
  field: 'comentarioFinal',
  label: '2 - Deseja realizar algum comentário sobre o colaborador em questão?',
} as const

export type ExperienceEvaluationQuestionField = (typeof EXPERIENCE_EVALUATION_QUESTIONS)[number]['field']
export type ExperienceEvaluationScoreOption = (typeof EXPERIENCE_EVALUATION_SCORE_OPTIONS)[number]
