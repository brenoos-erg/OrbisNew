// prisma/seed.ts
import { PrismaClient, UserStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  /* =========================
     USUÁRIO ADMINISTRADOR
     ========================= */
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      login: 'admin',
      fullName: 'Administrador do Sistema',
      email: 'admin@empresa.com',
      phone: '+55 31 99999-9999',
      status: UserStatus.ATIVO,
      role: 'ADMIN',
    },
  })
  console.log('✅ Usuário admin criado:', adminUser.email)

  /* =========================
     USUÁRIOS APROVADORES (VIDAL / LORENA)
     ========================= */

  const vidalUser = await prisma.user.upsert({
    where: { email: 'eduardo.vidal@ergengenharia.com.br' },
    update: {},
    create: {
      login: 'vidal',
      fullName: 'Eduardo Vidal',
      email: 'eduardo.vidal@ergengenharia.com.br',
      phone: '',
      status: UserStatus.ATIVO,
      role: 'RH',
    },
  })

  const lorenaUser = await prisma.user.upsert({
    where: { email: 'lorena.oliveira@ergengenharia.com.br' },
    update: {},
    create: {
      login: 'lorena',
      fullName: 'Lorena Oliveira',
      email: 'lorena.oliveira@ergengenharia.com.br',
      phone: '',
      status: UserStatus.ATIVO,
      role: 'RH',
    },
  })

  console.log(
    '✅ Usuários aprovadores criados:',
    vidalUser.email,
    lorenaUser.email,
  )

  /* =========================
     DEPARTAMENTOS
     ========================= */

  const departamentos = [
    { code: '01', name: 'ADMINISTRATIVO' },
    { code: '02', name: 'APOIO/COPA' },
    { code: '03', name: 'COMERCIAL' },
    { code: '04', name: 'COMPRAS' },
    { code: '05', name: 'COMUNICAÇÃO' },
    { code: '06', name: 'CONTÁBIL/FISCAL' },
    { code: '07', name: 'CUSTOS E CONTRATOS' },
    { code: '08', name: 'DEPARTAMENTO PESSOAL' },
    { code: '09', name: 'ENGENHARIA' },
    { code: '10', name: 'FINANCEIRO' },
    { code: '11', name: 'LOGÍSTICA' },
    { code: '12', name: 'MEDIÇÃO' },
    { code: '13', name: 'MEIO AMBIENTE' },
    { code: '14', name: 'PRAD' },
    { code: '15', name: 'PROJETOS' },
    { code: '16', name: 'QUALIDADE' },
    { code: '17', name: 'RECURSOS HUMANOS' },
    { code: '18', name: 'SIG' },
    { code: '19', name: 'SEGURANÇA DO TRABALHO' },
    { code: '20', name: 'TECNOLOGIA DA INFORMAÇÃO' },
    { code: '21', name: 'TOPOGRAFIA' },
    { code: '22', name: 'GEOTECNOLOGIAS' },
    { code: '23', name: 'LASER SCANNER' },
    { code: '24', name: 'GEOTECNIA' },
    { code: '25', name: 'CONTROLE TECNOLÓGICO' },
    { code: '26', name: 'GESTÃO DE FAUNA' },
    { code: '27', name: 'GEOREFERENCIAMENTO' },
    { code: '28', name: 'FERROVIA' },
    { code: '29', name: 'GEOLOGIA' },
  ]

  for (const d of departamentos) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: {
        code: d.code,
        name: d.name,
      },
    })
  }
  console.log('✅ Departamentos cadastrados.')

  /* =========================
     TIPOS DE SOLICITAÇÃO BÁSICOS
     (ex: Vale-transporte)
     ========================= */

  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Vale-transporte' },
    update: {},
    create: {
      id: randomUUID(),
      nome: 'Vale-transporte',
      descricao: 'Inclusão/alteração de rotas de vale-transporte',
      schemaJson: {
        meta: {
          centros: [],
          departamentos: [],
        },
        camposEspecificos: [
          {
            name: 'linha',
            label: 'Linha de ônibus',
            type: 'text',
            required: true,
          },
          {
            name: 'empresa',
            label: 'Empresa de transporte',
            type: 'text',
          },
          {
            name: 'valor',
            label: 'Valor mensal estimado',
            type: 'number',
          },
        ],
      },
      updatedAt: new Date(),
    },
  })

  console.log('✅ Tipo de solicitação "Vale-transporte" criado/atualizado.')

  const rhDepartment = await prisma.department.findFirst({
    where: { name: 'RECURSOS HUMANOS' },
  })

  const dpDepartment = await prisma.department.findFirst({
    where: { name: { contains: 'DEPARTAMENTO PESSOAL', mode: 'insensitive' } },
  })

  /* =========================
     TIPO SOLICITAÇÃO DE ABONO EDUCACIONAL (RH)
     ========================= */

  if (rhDepartment) {
    const schemaAbonoEducacional = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        {
          name: 'nomeColaborador',
          label: 'Nome do colaborador',
          type: 'text',
          required: true,
        },
        {
          name: 'matricula',
          label: 'Matrícula',
          type: 'text',
          required: true,
        },
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'text',
          required: true,
        },
        {
          name: 'contatoSetor',
          label: 'Contato setor',
          type: 'text',
        },
        {
          name: 'centroCusto',
          label: 'Centro de custo',
          type: 'text',
          required: true,
        },
        {
          name: 'email',
          label: 'E-mail',
          type: 'text',
          required: true,
        },
        {
          name: 'empresa',
          label: 'Empresa',
          type: 'text',
        },
        {
          name: 'localTrabalho',
          label: 'Local de trabalho',
          type: 'text',
        },
        {
          name: 'telefone',
          label: 'Telefone',
          type: 'text',
        },
        {
          name: 'cbo',
          label: 'CBO',
          type: 'text',
        },
        {
          name: 'escolaridade',
          label: 'Escolaridade',
          type: 'text',
        },
        {
          name: 'tipoContratacao',
          label: 'Tipo de contratação',
          type: 'text',
        },
        {
          name: 'beneficio',
          label: 'Benefício',
          type: 'text',
        },
        {
          name: 'valorBeneficio',
          label: 'Valor do benefício',
          type: 'text',
        },
        {
          name: 'nivel',
          label: 'Nível',
          type: 'text',
        },
        {
          name: 'observacaoSolicitante',
          label: 'Observações do solicitante',
          type: 'textarea',
        },
        {
          name: 'contratadaUmAno',
          label: 'Contratada há, no mínimo, 01 ano',
          type: 'checkbox',
        },
        {
          name: 'ausenciaAdvertencias',
          label: 'Ausência de faltas, advertências disciplinares.',
          type: 'checkbox',
        },
        {
          name: 'cursosConcluidos',
          label: 'Cursos concluídos com notas/exercícios/provas',
          type: 'checkbox',
        },
        {
          name: 'statusRh',
          label: 'Status',
          type: 'select',
          options: ['Deferido', 'Indeferido'],
        },
        {
          name: 'assistenteRh',
          label: 'Assistente Recursos Humanos',
          type: 'text',
        },
        {
          name: 'calculoAbono',
          label: 'Cálculo do abono (se mensal ou será pago)',
          type: 'textarea',
        },
        {
          name: 'observacoesRh',
          label: 'Observações',
          type: 'textarea',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'Solicitação de Abono Educacional' },
      update: {
        descricao: 'Solicitação para avaliação e concessão de abono educacional',
        schemaJson: schemaAbonoEducacional,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        nome: 'Solicitação de Abono Educacional',
        descricao: 'Solicitação para avaliação e concessão de abono educacional',
        schemaJson: schemaAbonoEducacional,
        updatedAt: new Date(),
      },
    })

    console.log(
      '✅ Tipo de solicitação "Solicitação de Abono Educacional" criado/atualizado.',
    )
  } else {
    console.warn(
        '⚠️ Departamento de Recursos Humanos não encontrado. Tipos RH (Abono Educacional, Checklist de Documentos para Admissão, RQ_063, RQ.RH.103 e RQ_091) não foram criados.',
    )
  }

  /* =========================
      TIPOS RH ESPECÍFICOS
     - Checklist de Documentos para Admissão (RH)
     - RQ.RH.103 - Avaliação do Período de Experiência (RH)
     - RQ_091 - Solicitação de Incentivo à Educação (RH)
     ========================= */
      if (rhDepartment) {
    /* =========================
       CHECKLIST DE DOCUMENTOS PARA ADMISSÃO (RH)
       ========================= */

    const schemaChecklistDocs = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        {
          name: 'descricaoSolicitacao',
          label: 'Descrição da solicitação',
          type: 'textarea',
          required: true,
          // Texto fornecido pelo solicitante para ser exibido já preenchido no formulário
          defaultValue:
            'Prezado candidato, seja muito bem vindo a ERG Engenharia! Para que possamos seguir com o seu processo de admissão é INDISPENSÁVEL que você apresente toda a sua documentação pessoal conforme indicação abaixo, via postagem eletrônica. Todos os arquivos devem ser individuais e renomeados conforme exemplo: RG-João Silva; CPF-João Silva; Endereço-João Silva, Foto-João Silva, etc.\n\nImportante: Neste momento não há necessidade de comparecimento na empresa de forma presencial. Toda a documentação após recebida será analisada pela equipe de RH, que entrará em contato para avançarmos com o processo. O sucesso da sua admissão depende desta etapa, portanto não deixe de anexar os todos documentos devidamente renomeados em até 24 horas a partir o recebimento deste link.\n\nDúvidas quanto a postagem dos documentos, gentileza entrar em contato com o RH pelo telefone (31) 2138-4700 ou e-mail rh@ergbh.com.br.\n\nObs.: Obrigatório o preenchimento do primeiro campo logo abaixo " E-mail Solicitante"',
        },
        {
          name: 'nomeCompleto',
          label: 'Nome completo',
          type: 'text',
          required: true,
        },
        {
          name: 'telefone',
          label: 'Telefone',
          type: 'text',
          required: true,
        },
        {
          name: 'documentoPaisRepresentantes',
          label: 'Doc. desde pais/representantes (A)',
          type: 'checkbox',
        },
        { name: 'rg', label: 'RG', type: 'checkbox' },
        { name: 'cpf', label: 'CPF', type: 'checkbox' },
        { name: 'cnh', label: 'CNH', type: 'checkbox' },
        {
          name: 'comprovacaoRenda',
          label: 'Documento comprovação renda ?',
          type: 'checkbox',
        },
        {
          name: 'carteiraTrabalhoOpcao1',
          label: 'Carteira de trabalho (Opção 1 - Verificar candidato na CM)',
          type: 'checkbox',
        },
        {
          name: 'carteiraTrabalhoOpcao2',
          label:
            'Carteira trabalho (Opção 2 - Preencher manualmente no site (link do Maria))',
          type: 'checkbox',
        },
        {
          name: 'tituloEleitor',
          label: 'Título de eleitor',
          type: 'checkbox',
        },
        {
          name: 'carteiraReservista',
          label: 'Carteira de reservista (se ex-militar ou sexo masculino)',
          type: 'checkbox',
        },
        {
          name: 'cadastroSus',
          label: 'Cadastro no SUS (se sexo masculino)',
          type: 'checkbox',
        },
        {
          name: 'comprovanteEscolaridade',
          label:
            'Comprovante de escolaridade (se o nível de escolaridade exigir comprovação)',
          type: 'checkbox',
        },
        {
          name: 'comprovanteResidencia',
          label: 'Comprovante de residência',
          type: 'checkbox',
        },
        {
          name: 'comprovanteConjuge',
          label: 'Comprovante do cônjuge (se casado)',
          type: 'checkbox',
        },
        {
          name: 'comprovanteNascimentoFilhos',
          label: 'Comprovante de nascimento do(s) filho(s)',
          type: 'checkbox',
        },
        {
          name: 'comprovanteEstadoCivil',
          label: 'Comprovante de estado civil',
          type: 'checkbox',
        },
        { name: 'exameAdmissionais', label: 'Exames admissionais', type: 'checkbox' },
        { name: 'carteiraVacina', label: 'Carteira de vacina', type: 'checkbox' },
        {
          name: 'cpfDependentesIrpf',
          label: 'CPF (dependentes de IRPF)',
          type: 'checkbox',
        },
        {
          name: 'exameAudiometria',
          label: 'Exame de audiometria (se tiver função que exige)',
          type: 'checkbox',
        },
        {
          name: 'documentosDependentesIrpf',
          label: 'Documentos dos dependentes de IRPF (anexo anterior na CM)',
          type: 'checkbox',
        },
        {
          name: 'declaracaoCpf',
          label: 'Declaração do Cadastro de Pessoa Física (2ª via da Receita Federal)',
          type: 'checkbox',
        },
        {
          name: 'cursoMopp',
          label: 'Curso MOPP (Caminhão de carga/Resíduos - PCD)',
          type: 'checkbox',
        },
        {
          name: 'cidDependentes',
          label: 'CID: (dependentes de IRPF)',
          type: 'checkbox',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'Checklist de Documentos para Admissão' },
      update: {
        descricao: 'Checklist de documentos para encaminhamento ao RH',
        schemaJson: schemaChecklistDocs,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        nome: 'Checklist de Documentos para Admissão',
        descricao: 'Checklist de documentos para encaminhamento ao RH',
        schemaJson: schemaChecklistDocs,
        updatedAt: new Date(),
      },
    })

    console.log(
      '✅ Tipo de solicitação "Checklist de Documentos para Admissão" criado/atualizado.',
    )
  }

  if (rhDepartment) {
    const schemaRQ091 = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        {
          name: 'nomeColaborador',
          label: 'Nome do colaborador',
          type: 'text',
          required: true,
        },
        {
          name: 'matricula',
          label: 'Matrícula',
          type: 'text',
          required: true,
        },
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'text',
          required: true,
        },
        {
          name: 'contratante',
          label: 'Contratante',
          type: 'text',
        },
        {
          name: 'tipoContrato',
          label: 'Tipo de contrato',
          type: 'text',
        },
        {
          name: 'nivelInstrucao',
          label: 'Nível de instrução',
          type: 'text',
        },
        {
          name: 'escolaridade',
          label: 'Escolaridade',
          type: 'text',
        },
        {
          name: 'curso',
          label: 'Curso',
          type: 'text',
          required: true,
        },
        {
          name: 'instituicao',
          label: 'Instituição de ensino',
          type: 'text',
          required: true,
        },
        {
          name: 'semestre',
          label: 'Semestre',
          type: 'text',
        },
        {
          name: 'dataInicio',
          label: 'Data de início',
          type: 'date',
        },
        {
          name: 'dataFim',
          label: 'Data fim',
          type: 'date',
        },
        {
          name: 'cidadeUf',
          label: 'Cidade/UF',
          type: 'text',
        },
        {
          name: 'forma',
          label: 'Forma (Presencial/online)',
          type: 'text',
        },
        {
          name: 'telefone',
          label: 'Telefone',
          type: 'text',
        },
        {
          name: 'centroCusto',
          label: 'Centro de Custo',
          type: 'text',
        },
        {
          name: 'valorMensalDespesas',
          label: 'Valor (mensal) das despesas de estudo',
          type: 'text',
        },
        {
          name: 'areaCurso',
          label: 'Área do curso',
          type: 'text',
        },
        {
          name: 'declaracao',
          label: 'Declaro que',
          type: 'textarea',
        },
        {
          name: 'cienteRegras',
          label: 'Declaro ter lido e estou ciente das regras.',
          type: 'checkbox',
        },
        {
          name: 'obrigatorioAnexoTermo',
          label:
            'Obrigatório anexar Termo de Compromisso assinado, Comprovante de Matrícula e Comprovante de Pagamento da Mensalidade. Se anexado, marque este checkbox.',
          type: 'checkbox',
        },
        {
          name: 'recebimentoAguardado',
          label: 'Recebimento aguardado para 2023/2024.',
          type: 'checkbox',
        },
        {
          name: 'contratadaUmAno',
          label: 'Contratado(a) há, no mínimo, 01 ano',
          type: 'checkbox',
        },
        {
          name: 'ausenciaAdvertencias',
          label: 'Ausência de faltas, advertências disciplinares.',
          type: 'checkbox',
        },
        {
          name: 'cursoCursadoComFrequencia',
          label: 'Curso cursado com frequência/presença',
          type: 'checkbox',
        },
        {
          name: 'statusRh',
          label: 'Status',
          type: 'select',
          options: ['Deferido', 'Indeferido'],
        },
        {
          name: 'avaliacaoRh',
          label: 'Avaliação Recursos Humanos',
          type: 'textarea',
        },
        {
          name: 'calculoValor',
          label: 'Cálculo do valor mensal a ser pago',
          type: 'textarea',
        },
        {
          name: 'observacoes',
          label: 'Observações',
          type: 'textarea',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'RQ_091 - Solicitação de Incentivo à Educação' },
      update: {
        descricao: 'Solicitação de incentivo à educação (Recursos Humanos)',
        schemaJson: schemaRQ091,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_091',
        nome: 'RQ_091 - Solicitação de Incentivo à Educação',
        descricao: 'Solicitação de incentivo à educação (Recursos Humanos)',
        schemaJson: schemaRQ091,
        updatedAt: new Date(),
      },
    })

    console.log(
      '✅ Tipo de solicitação "RQ_091 - Solicitação de Incentivo à Educação" criado/atualizado.',
    )
  }
  /* =========================
     TIPO RQ.RH.103 - AVALIAÇÃO DO PERÍODO DE EXPERIÊNCIA (RH)
     ========================= */

  if (rhDepartment) {
    const notaOptions = ['INSUFICIENTE', 'PARCIAL', 'PLENA', 'ACIMA DA MÉDIA']

    const schemaRQ103 = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        {
          name: 'colaboradorAvaliado',
          label: 'Colaborador avaliado',
          type: 'text',
          required: true,
        },
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'text',
          required: true,
        },
        {
          name: 'contratoSetor',
          label: 'Contrato / Setor',
          type: 'text',
        },
        {
          name: 'dataAdmissao',
          label: 'Data de Admissão',
          type: 'date',
        },
        {
          name: 'matricula',
          label: 'Matrícula',
          type: 'text',
        },
        {
          name: 'gestor',
          label: 'Gestor',
          type: 'text',
        },
        {
          name: 'unidade',
          label: 'Unidade',
          type: 'text',
        },
        {
          name: 'periodoAvaliacao',
          label: 'Período de Avaliação',
          type: 'text',
        },
        {
          name: 'notaRelacionamento',
          label:
            'Relacionamento — Relaciona-se com os colaboradores de forma igualitária, respeitando individualidades e estabelecendo relações positivas.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaComunicacao',
          label:
            'Comunicação — Se comunica de forma adequada e boa apresentação do trabalho realizado.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaAtitude',
          label:
            'Atitude — Presença, participação e demonstração de disponibilidade e entusiasmo.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaSaudeSeguranca',
          label:
            'Saúde e Segurança — Trabalha de forma segura, não se expõe a riscos e não desrespeita as regras e normas de segurança.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaDominioTecnico',
          label:
            'Domínio Técnico/Processos — Possui domínio técnico das atividades, apresenta boas entregas e atende prazos.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaAdaptabilidade',
          label:
            'Adaptabilidade, Mobilidade e Gestão da Mudança — Capacidade de adaptação e disposição para mudanças e deslocamentos quando necessário.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'notaAdequacaoCultura',
          label:
            'Adequação à Cultura e aos Valores — Age em conformidade com os valores e a cultura da empresa.',
          type: 'select',
          options: notaOptions,
        },
        {
          name: 'recomendacaoEfetivacao',
          label: 'É recomendada a efetivação do colaborador?',
          type: 'select',
          options: ['Sim', 'Não', 'Prorrogar período de experiência'],
        },
        {
          name: 'observacoesFinais',
          label:
            'Deseja registrar alguma observação sobre o colaborador ou sobre a avaliação?',
          type: 'textarea',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'RQ.RH.103 - Avaliação do Período de Experiência' },
      update: {
        descricao: 'Avaliação do período de experiência para colaboradores (Recursos Humanos)',
        schemaJson: schemaRQ103,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_RH_103',
        nome: 'RQ.RH.103 - Avaliação do Período de Experiência',
        descricao: 'Avaliação do período de experiência para colaboradores (Recursos Humanos)',
        schemaJson: schemaRQ103,
        updatedAt: new Date(),
      },
    })

    console.log('✅ Tipo de solicitação "RQ.RH.103 - Avaliação do Período de Experiência" criado/atualizado.')
  }


  /* =========================
     TIPO DE ADMISSÃO (DP)
     ========================= */

  if (dpDepartment) {
    const schemaAdmissao = {
      meta: {
        departamentos: [dpDepartment.id],
      },
      camposEspecificos: [],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'Solicitação de Admissão' },
      update: {
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: schemaAdmissao,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        nome: 'Solicitação de Admissão',
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: schemaAdmissao,
        updatedAt: new Date(),
      },
    })

    console.log(
      '✅ Tipo de solicitação "Solicitação de Admissão" criado/atualizado.',
    )
  } else {
    console.warn(
      '⚠️ Departamento Pessoal não encontrado. Tipo "Solicitação de Admissão" não foi atualizado.',
    )
  }

  /* =========================
     TIPO RQ_063 - SOLICITAÇÃO DE PESSOAL (RH)
     ========================= */

  if (rhDepartment) {
    const schemaRQ063 = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'select',
          required: true,
          options: [],
        },
        {
          name: 'setorOuProjeto',
          label: 'Setor e/ou Projeto',
          type: 'text',
          required: true,
        },
        {
          name: 'vagaPrevistaContrato',
          label: 'Vaga prevista em contrato?',
          type: 'select',
          options: ['Sim', 'Não'],
          required: true,
        },
        {
          name: 'localTrabalho',
          label: 'Local de Trabalho',
          type: 'text',
          required: true,
        },
        {
          name: 'horarioTrabalho',
          label: 'Horário de Trabalho',
          type: 'text',
        },
        {
          name: 'coordenadorContrato',
          label: 'Coordenador do Contrato',
          type: 'text',
        },
        {
          name: 'motivoVaga',
          label: 'Motivo da vaga',
          type: 'select',
          options: ['Substituição', 'Aumento de quadro'],
          required: true,
        },
        {
          name: 'tipoContratacao',
          label: 'Contratação',
          type: 'select',
          options: ['Temporária', 'Permanente'],
          required: true,
        },
        {
          name: 'justificativaVaga',
          label: 'Justificativa da vaga',
          type: 'textarea',
          required: true,
        },
        {
          name: 'principaisAtividades',
          label: 'Principais atividades',
          type: 'textarea',
        },
        {
          name: 'atividadesComplementares',
          label: 'Atividades complementares',
          type: 'textarea',
        },
        {
          name: 'escolaridade',
          label: 'Escolaridade',
          type: 'text',
        },
        {
          name: 'curso',
          label: 'Curso',
          type: 'text',
        },
        {
          name: 'escolaridadeCompleta',
          label: 'Escolaridade completa?',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'cursoEmAndamento',
          label: 'Curso em andamento?',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'periodoModulo',
          label: 'Período / Módulo - mínimo ou máximo',
          type: 'text',
        },
        {
          name: 'requisitosConhecimentos',
          label: 'Requisitos e conhecimentos necessários',
          type: 'textarea',
        },
        {
          name: 'competenciasComportamentais',
          label: 'Competências comportamentais exigidas',
          type: 'textarea',
        },
        {
          name: 'solicitacaoCracha',
          label: 'Crachá',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'solicitacaoRepublica',
          label: 'República',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'solicitacaoUniforme',
          label: 'Uniforme',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'solicitacaoOutros',
          label: 'Outros (descrever)',
          type: 'text',
        },
        {
          name: 'solicitacaoTesteDirecao',
          label: 'Teste de direção',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'solicitacaoEPIs',
          label: 'EPIs',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'solicitacaoPostoTrabalho',
          label: 'Posto de trabalho',
          type: 'select',
          options: ['Sim', 'Não'],
        },
        {
          name: 'projetosLocal',
          label: 'Local (Matriz ou Filial)',
          type: 'select',
          options: ['Matriz', 'Filial'],
        },
        {
          name: 'projetosPrevistoContrato',
          label: 'Previsto em contrato (Salários, Benefícios, Carga horária e Outros)',
          type: 'textarea',
        },
        {
          name: 'rhNomeProfissional',
          label: 'Nome do profissional',
          type: 'text',
        },
        {
          name: 'rhDataAdmissao',
          label: 'Data de admissão',
          type: 'date',
        },
        {
          name: 'rhObservacoes',
          label: 'Observações',
          type: 'textarea',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'RQ_063 - Solicitação de Pessoal' },
      update: {
        descricao: 'Requisição de pessoal (Recursos Humanos)',
        schemaJson: schemaRQ063,
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        nome: 'RQ_063 - Solicitação de Pessoal',
        descricao: 'Requisição de pessoal (Recursos Humanos)',
        schemaJson: schemaRQ063,
        updatedAt: new Date(),
      },
    })

    console.log(
      '✅ Tipo de solicitação "RQ_063 - Solicitação de Pessoal" criado/atualizado.',
    )
  }

  /* =========================
     CONTROLE DE ACESSO
     ========================= */

  const solicitacoesModule = await prisma.module.upsert({
    where: { key: 'solicitacoes' },
    update: {},
    create: { key: 'solicitacoes', name: 'Solicitações' },
  })
  console.log('✅ Módulo criado:', solicitacoesModule.name)

  const configModule = await prisma.module.upsert({
    where: { key: 'configuracoes' },
    update: {},
    create: { key: 'configuracoes', name: 'Configurações' },
  })
  console.log('✅ Módulo criado:', configModule.name)

  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: 'Administradores' },
    update: {},
    create: {
      name: 'Administradores',
      notes: 'Acesso total ao sistema',
    },
  })
  console.log('✅ Grupo criado:', adminGroup.name)

  await prisma.accessGroupGrant.upsert({
    where: {
      groupId_moduleId: {
        groupId: adminGroup.id,
        moduleId: solicitacoesModule.id,
      },
    },
    update: {
      actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
    },
    create: {
      groupId: adminGroup.id,
      moduleId: solicitacoesModule.id,
      actions: ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
    },
  })

  await prisma.groupMember.upsert({
    where: {
      userId_groupId: {
        userId: adminUser.id,
        groupId: adminGroup.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      groupId: adminGroup.id,
      role: 'MANAGER',
    },
  })
  console.log('✅ Usuário admin adicionado ao grupo Administradores')

  const tiGroup = await prisma.accessGroup.upsert({
    where: { name: 'Tecnologia da Informação' },
    update: {},
    create: { name: 'Tecnologia da Informação', notes: 'Grupo do TI' },
  })
  console.log('✅ Grupo criado:', tiGroup.name)

  await prisma.accessGroupGrant.upsert({
    where: {
      groupId_moduleId: {
        groupId: tiGroup.id,
        moduleId: configModule.id,
      },
    },
    update: { actions: ['VIEW', 'CREATE', 'UPDATE'] },
    create: {
      groupId: tiGroup.id,
      moduleId: configModule.id,
      actions: ['VIEW', 'CREATE', 'UPDATE'],
    },
  })
  console.log('✅ Permissões de TI aplicadas ao módulo Configurações')

  const rq063ApproversGroup = await prisma.accessGroup.upsert({
    where: { name: 'Aprovadores RQ_063' },
    update: {},
    create: {
      name: 'Aprovadores RQ_063',
      notes: 'Gestores que podem aprovar a RQ_063 - Solicitação de Pessoal',
    },
  })
  console.log('✅ Grupo criado:', rq063ApproversGroup.name)

  await prisma.accessGroupGrant.upsert({
    where: {
      groupId_moduleId: {
        groupId: rq063ApproversGroup.id,
        moduleId: solicitacoesModule.id,
      },
    },
    update: {
      actions: ['VIEW', 'APPROVE'],
    },
    create: {
      groupId: rq063ApproversGroup.id,
      moduleId: solicitacoesModule.id,
      actions: ['VIEW', 'APPROVE'],
    },
  })
  console.log(
    '✅ Permissões de Aprovadores RQ_063 aplicadas ao módulo Solicitações',
  )

  await prisma.groupMember.upsert({
    where: {
      userId_groupId: {
        userId: vidalUser.id,
        groupId: rq063ApproversGroup.id,
      },
    },
    update: {},
    create: {
      userId: vidalUser.id,
      groupId: rq063ApproversGroup.id,
      role: 'MANAGER',
    },
  })

  await prisma.groupMember.upsert({
    where: {
      userId_groupId: {
        userId: lorenaUser.id,
        groupId: rq063ApproversGroup.id,
      },
    },
    update: {},
    create: {
      userId: lorenaUser.id,
      groupId: rq063ApproversGroup.id,
      role: 'MANAGER',
    },
  })
  console.log('✅ Vidal e Lorena adicionados ao grupo Aprovadores RQ_063')

  console.log('🎉 Seed concluído com sucesso!')
}

main()
  .catch(async (e) => {
    console.error('❌ Erro ao executar seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
