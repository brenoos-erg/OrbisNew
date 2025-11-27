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
    where: { email: 'eduardo.vidal@ergengenharia.com.br' }, // ajuste se o e-mail for outro
    update: {},
    create: {
      login: 'vidal',
      fullName: 'Eduardo Vidal',
      email: 'eduardo.vidal@ergengenharia.com.br',
      phone: '',
      status: UserStatus.ATIVO,
      role: 'RH', // enum Role
    },
  })

  const lorenaUser = await prisma.user.upsert({
    where: { email: 'lorena.oliveira@ergengenharia.com.br' }, // ajuste se o e-mail for outro
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
      where: { code: d.code }, // code é unique no model
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

  /* =========================
     TIPO SOLICITAÇÃO DE ABONO EDUCACIONAL (RH)
     ========================= */

  if (rhDepartment) {
    const schemaAbonoEducacional = {
      meta: {
        departamentos: [rhDepartment.id],
      },
      camposEspecificos: [
        { name: 'nomeColaborador', label: 'Nome do colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matrícula', type: 'text', required: true },
        { name: 'cargo', label: 'Cargo', type: 'text', required: true },
        { name: 'contatoSetor', label: 'Contato setor', type: 'text' },
        { name: 'centroCusto', label: 'Centro de custo', type: 'text', required: true },
        { name: 'email', label: 'E-mail', type: 'text', required: true },
        { name: 'empresa', label: 'Empresa', type: 'text' },
        { name: 'localTrabalho', label: 'Local de trabalho', type: 'text' },
        { name: 'telefone', label: 'Telefone', type: 'text' },
        { name: 'cbo', label: 'CBO', type: 'text' },
        { name: 'escolaridade', label: 'Escolaridade', type: 'text' },
        { name: 'tipoContratacao', label: 'Tipo de contratação', type: 'text' },
        { name: 'beneficio', label: 'Benefício', type: 'text' },
        { name: 'valorBeneficio', label: 'Valor do benefício', type: 'text' },
        { name: 'nivel', label: 'Nível', type: 'text' },
        { name: 'observacaoSolicitante', label: 'Observações do solicitante', type: 'textarea' },
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
        { name: 'observacoesRh', label: 'Observações', type: 'textarea' },
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
      '⚠️ Departamento de Recursos Humanos não encontrado. Tipos RH (Abono Educacional e RQ_063) não foram criados.',
    )
  }

  /* =========================
     TIPO RQ_063 - SOLICITAÇÃO DE PESSOAL (RH)
     ========================= */

  if (rhDepartment) {
    const schemaRQ063 = {
      meta: {
        // Esse tipo só aparece para RH
        departamentos: [rhDepartment.id],
      },

      camposEspecificos: [
        // CARGO (select especial)
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'select',
          required: true,
          // deixamos vazio porque o FRONT vai buscar em /api/positions
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

        // BLOCO 2
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

        // BLOCO 3 – Requisitos
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

        // BLOCO 4 – Solicitações para o novo funcionário
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

        // BLOCO 5 – Escritório de Projetos
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

        // BLOCO 6 – RH
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

      // atualiza se já existir
      update: {
        descricao: 'Requisição de pessoal (Recursos Humanos)',
        schemaJson: schemaRQ063,
        updatedAt: new Date(),
      },

      // cria se não existir
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

  // 1️⃣ Criar módulo Solicitações
  const solicitacoesModule = await prisma.module.upsert({
    where: { key: 'solicitacoes' },
    update: {},
    create: { key: 'solicitacoes', name: 'Solicitações' },
  })
  console.log('✅ Módulo criado:', solicitacoesModule.name)

  // 2️⃣ Criar módulo Configurações
  const configModule = await prisma.module.upsert({
    where: { key: 'configuracoes' },
    update: {},
    create: { key: 'configuracoes', name: 'Configurações' },
  })
  console.log('✅ Módulo criado:', configModule.name)

  // 3️⃣ Criar grupo Administradores
  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: 'Administradores' },
    update: {},
    create: {
      name: 'Administradores',
      notes: 'Acesso total ao sistema',
    },
  })
  console.log('✅ Grupo criado:', adminGroup.name)

  // 4️⃣ Permissões de Administradores no módulo Solicitações
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

  // 5️⃣ Adicionar usuário admin ao grupo Administradores
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

  // 6️⃣ Criar grupo Tecnologia da Informação
  const tiGroup = await prisma.accessGroup.upsert({
    where: { name: 'Tecnologia da Informação' },
    update: {},
    create: { name: 'Tecnologia da Informação', notes: 'Grupo do TI' },
  })
  console.log('✅ Grupo criado:', tiGroup.name)

  // 7️⃣ Permissões de TI no módulo Configurações
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

  // 8️⃣ Criar grupo Aprovadores RQ_063
  const rq063ApproversGroup = await prisma.accessGroup.upsert({
    where: { name: 'Aprovadores RQ_063' },
    update: {},
    create: {
      name: 'Aprovadores RQ_063',
      notes: 'Gestores que podem aprovar a RQ_063 - Solicitação de Pessoal',
    },
  })
  console.log('✅ Grupo criado:', rq063ApproversGroup.name)

  // 9️⃣ Permissões dos Aprovadores RQ_063 no módulo Solicitações (VIEW + APPROVE)
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

  // 🔟 Adicionar Vidal e Lorena ao grupo Aprovadores RQ_063
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
