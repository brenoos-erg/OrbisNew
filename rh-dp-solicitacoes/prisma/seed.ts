/* prisma/seed.ts */

import { Action, ModuleLevel, PrismaClient, UserStatus } from '@prisma/client'
import { ALL_ACTIONS, FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { OFFICIAL_DEPARTMENTS, OFFICIAL_DEPARTMENT_CODES } from '@/lib/officialDepartment'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'


async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12)
}

function hostOf(url?: string) {
  if (!url) return '(undefined)'
  try {
    return new URL(url).host
  } catch {
    // fallback simples se a URL tiver formato postgres e não "URL() friendly"
    const m = url.match(/@([^/:?]+)(?::\d+)?\//)
    return m?.[1] ?? '(parse-failed)'
  }
}



async function main() {
  console.log('🌱 Iniciando seed...')

  const databaseHost = hostOf(process.env.DATABASE_URL)
  console.log('🔎 Host DATABASE_URL:', databaseHost)

  // PrismaClient usa apenas DATABASE_URL
  const prisma = new PrismaClient()

  const hasTable = async (tableName: string) => {
    const result = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND LOWER(table_name) = LOWER(${tableName})
    `

    const total = Number(result[0]?.total ?? 0)
    return total > 0
  }

  

  /* =========================
     DEPARTAMENTOS
     ========================= */
    for (const d of OFFICIAL_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: {
        name: d.name,
        sigla: d.sigla,
      },
      create: {
        code: d.code,
        name: d.name,
        sigla: d.sigla,
      },
    })
  }

 const tiDepartment = await prisma.department.findUnique({
    where: { code: '20' },
  })
  if (!tiDepartment) throw new Error('Departamento TI (code=20) não encontrado.')

  await prisma.user.updateMany({
    where: {
      department: {
        code: {
          notIn: OFFICIAL_DEPARTMENT_CODES as string[],
        },
      },
    },
    data: {
      departmentId: tiDepartment.id,
    },
  })

  await prisma.userDepartment.deleteMany({
    where: {
      department: {
        code: {
          notIn: OFFICIAL_DEPARTMENT_CODES as string[],
        },
      },
    },
  })

  const legacyDepartments = await prisma.department.findMany({
    where: {
      code: {
        notIn: OFFICIAL_DEPARTMENT_CODES as string[],
      },
    },
    select: { id: true },
  })

  const legacyDepartmentIds = legacyDepartments.map((department) => department.id)

  if (legacyDepartmentIds.length > 0) {
    const legacyDepartmentFilter = {
      in: legacyDepartmentIds,
    }

    await prisma.solicitation.updateMany({
      where: { departmentId: legacyDepartmentFilter },
      data: { departmentId: tiDepartment.id },
    })

    await prisma.departmentModule.deleteMany({
      where: { departmentId: legacyDepartmentFilter },
    })

    await prisma.costCenter.updateMany({
      where: { departmentId: legacyDepartmentFilter },
      data: { departmentId: null },
    })

    await prisma.position.updateMany({
      where: { departmentId: legacyDepartmentFilter },
      data: { departmentId: null },
    })

    await prisma.user.updateMany({
      where: { departmentId: legacyDepartmentFilter },
      data: { departmentId: tiDepartment.id },
    })

    await prisma.isoDocument.updateMany({
      where: { ownerDepartmentId: legacyDepartmentFilter },
      data: { ownerDepartmentId: tiDepartment.id },
    })

    await prisma.approverGroup.updateMany({
      where: { departmentId: legacyDepartmentFilter },
      data: { departmentId: null },
    })
  }

  await prisma.department.deleteMany({
    where: {
      code: {
        notIn: OFFICIAL_DEPARTMENT_CODES as string[],
      },
    },
  })

  console.log('✅ Departamentos cadastrados.')

  const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123'
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@ergengenharia.com.br' },
    update: {
      departmentId: tiDepartment.id,
      role: 'ADMIN',
      status: UserStatus.ATIVO,
      passwordHash: await hashPassword(defaultPassword),
      mustChangePassword: false,
    },
    create: {
      login: 'superadmin',
      fullName: 'Super Administrador',
      email: 'superadmin@ergengenharia.com.br',
      phone: '',
      status: UserStatus.ATIVO,
      role: 'ADMIN',
      departmentId: tiDepartment.id,
      passwordHash: await hashPassword(defaultPassword),
      mustChangePassword: false,
    },
  })
  console.log('✅ Usuário super admin local criado/atualizado:', superAdminUser.email)


  const rhDepartment = await prisma.department.findUnique({ where: { code: '17' } })
  const dpDepartment = await prisma.department.findUnique({ where: { code: '08' } })
  const sstDepartment = await prisma.department.findUnique({ where: { code: '19' } })
  if (!sstDepartment) throw new Error('Departamento SST (code=19) não encontrado.')
     const logisticaDepartment = await prisma.department.findUnique({ where: { code: '11' } })

 const rhTipoDepartamentos = [rhDepartment?.id].filter(
    (value): value is string => Boolean(value),
  )
  if (rhDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_RH_103' },
      update: {
        codigo: 'RQ.RH.002',
        nome: 'Avaliação do período de experiência',
        descricao: 'Solicitação de avaliação do período de experiência.',
        schemaJson: {
          meta: {
            departamentos: [rhDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_RH_103',
        codigo: 'RQ.RH.002',
        nome: 'Avaliação do período de experiência',
        descricao: 'Solicitação de avaliação do período de experiência.',
        schemaJson: {
          meta: {
            departamentos: [rhDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
    })
  }

  if (dpDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_106' },
      update: {
        codigo: 'RQ.DP.004',
       nome: 'Exclusão no plano saúde/odonto para dependentes',
        descricao: 'Solicitação de exclusão de dependente em plano de saúde/odonto.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_106',
        codigo: 'RQ.DP.004',
        nome: 'Exclusão no plano saúde/odonto para dependentes',
        descricao: 'Solicitação de exclusão de dependente em plano de saúde/odonto.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
         updatedAt: new Date(),
      },
    })

    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_115' },
      update: {
        codigo: 'RQ.DP.005',
         nome: 'Renúncia de benefício',
        descricao: 'Solicitação de renúncia de benefício.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_115',
        codigo: 'RQ.DP.005',
        nome: 'Renúncia de benefício',
        descricao: 'Solicitação de renúncia de benefício.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
         updatedAt: new Date(),
      },
    })

    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_240' },
      update: {
        codigo: 'RQ.DP.006',
        nome: 'Transferência de funcionário',
        descricao: 'Solicitação de transferência de funcionário.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_240',
        codigo: 'RQ.DP.006',
        nome: 'Transferência de funcionário',
        descricao: 'Solicitação de transferência de funcionário.',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            requiresApproval: false,
          },
        },
        updatedAt: new Date(),
      },
    })
  }

 if (logisticaDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_DP_049' },
      update: {
        codigo: 'RQ.LOG.002',
        nome: 'Identificação do condutor infrator multa de trânsito',
        descricao: 'FORMULÁRIO DE IDENTIFICAÇÃO DE MULTA DE TRÂNSITO',
        schemaJson: {
          meta: {
            departamentos: [logisticaDepartment.id],
            requiresApproval: false,
            prazoPadraoDias: 7,
            templateDownload: '/templates/rq-dp-049.xls',
            requiresAttachment: true,
            destinos: [
              { value: 'LOGISTICA', label: 'Logística' },
              { value: 'DP', label: 'Departamento Pessoal' },
              { value: 'RH', label: 'Recursos Humanos' },
            ],
          },
          camposEspecificos: [
            {
              name: 'destinadoPara',
              label: 'Destinado para',
              type: 'select',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'nomeInfrator',
              label: 'Nome do infrator',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
             {
              name: 'gestorImediato',
              label: 'Gestor imediato',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'centroCustoId',
              label: 'Centro de custo',
              type: 'cost_center',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'placaVeiculo',
              label: 'Placa do veículo',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'observacoes',
              label: 'Observações',
              type: 'textarea',
              section: 'Identificação da multa',
            },
          ],
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_DP_049',
        codigo: 'RQ.LOG.002',
        nome: 'Identificação do condutor infrator multa de trânsito',
        descricao: 'FORMULÁRIO DE IDENTIFICAÇÃO DE MULTA DE TRÂNSITO',
        schemaJson: {
          meta: {
            departamentos: [logisticaDepartment.id],
            requiresApproval: false,
            prazoPadraoDias: 7,
            templateDownload: '/templates/rq-dp-049.xls',
            requiresAttachment: true,
            destinos: [
              { value: 'LOGISTICA', label: 'Logística' },
              { value: 'DP', label: 'Departamento Pessoal' },
              { value: 'RH', label: 'Recursos Humanos' },
            ],
          },
          camposEspecificos: [
            {
              name: 'destinadoPara',
              label: 'Destinado para',
              type: 'select',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'nomeInfrator',
              label: 'Nome do infrator',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'gestorImediato',
              label: 'Gestor imediato',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'centroCustoId',
              label: 'Centro de custo',
              type: 'cost_center',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'placaVeiculo',
              label: 'Placa do veículo',
              type: 'text',
              required: true,
              section: 'Identificação da multa',
            },
            {
              name: 'observacoes',
              label: 'Observações',
              type: 'textarea',
              section: 'Identificação da multa',
            },
          ],
        },
        updatedAt: new Date(),
      },
    })
  }



 if (rhDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_063' },
      update: {
        codigo: 'RQ.RH.001',
        nome: 'Solicitação de pessoal',
        descricao: 'Solicitação de pessoal com fluxo RH e DP',
        schemaJson: { meta: { departamentos: rhTipoDepartamentos } },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_063',
        codigo: 'RQ.RH.001',
        nome: 'Solicitação de pessoal',
        descricao: 'Solicitação de pessoal com fluxo RH e DP',
        schemaJson: { meta: { departamentos: rhTipoDepartamentos } },
        updatedAt: new Date(),
      },
    })
  }

  if (logisticaDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_088' },
      update: {
        codigo: 'RQ.LOG.001',
        nome: 'Solicitação de veículos',
        descricao: 'Solicitação de veículos com aprovação e envio à Logística',
        schemaJson: { meta: { departamentos: [logisticaDepartment.id] }, camposEspecificos: [] },
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_088',
        codigo: 'RQ.LOG.001',
        nome: 'Solicitação de veículos',
        descricao: 'Solicitação de veículos com aprovação e envio à Logística',
        schemaJson: { meta: { departamentos: [logisticaDepartment.id] }, camposEspecificos: [] },
        updatedAt: new Date(),
      },
    })
  }

  /* =========================
     TIPOS DE SOLICITAÇÃO BÁSICOS
     ========================= */
  await prisma.tipoSolicitacao.deleteMany({
    where: {
      OR: [
        { id: 'VALE_TRANSPORTE' },
        { nome: { contains: 'Vale-transporte' } },
      ],
    },
  })

  await prisma.tipoSolicitacao.deleteMany({
    where: {
      OR: [
        { codigo: { startsWith: 'RQ.LEG.' } },
        { codigo: 'RQ.LEG.SOLICITACAO_EQUIPAMENTO' },
        { id: 'SOLICITACAO_EQUIPAMENTO' },
      ],
    },
  })

  await prisma.tipoSolicitacao.upsert({
    where: { id: 'RQ_089' },
    update: {
      codigo: 'RQ.TI.001',
      nome: 'Solicitação de equipamento',
      descricao: 'Solicitação para fornecimento de equipamento de TI',
      schemaJson: {
        meta: { departamentos: [tiDepartment.id] },
        camposEspecificos: [
          {
            name: 'tipoEquipamento',
            label: 'Tipo de equipamento',
            type: 'text',
            required: true,
            stage: 'solicitante',
            section: 'Dados da solicitação',
          },
          {
            name: 'justificativa',
            label: 'Justificativa',
            type: 'textarea',
            required: true,
            stage: 'solicitante',
            section: 'Dados da solicitação',
          },
        ],
      },
     updatedAt: new Date(),
    },
     create: {
      id: 'RQ_089',
        codigo: 'RQ.TI.001',
       nome: 'Solicitação de equipamento',
      descricao: 'Solicitação para fornecimento de equipamento de TI',
      schemaJson: {
        meta: { departamentos: [tiDepartment.id] },
        camposEspecificos: [
          {
            name: 'tipoEquipamento',
            label: 'Tipo de equipamento',
            type: 'text',
            required: true,
            stage: 'solicitante',
            section: 'Dados da solicitação',
          },
          {
            name: 'justificativa',
            label: 'Justificativa',
            type: 'textarea',
            required: true,
            stage: 'solicitante',
            section: 'Dados da solicitação',
          },
        ],
      },
      updatedAt: new Date(),
    },
  })
  console.log('✅ Tipo "RQ.089 - Solicitação de Equipamento" ok.')

  /* =========================
     DP: Solicitação de Admissão
     ========================= */
  if (dpDepartment) {
    const existingAdmissionByName = await prisma.tipoSolicitacao.findUnique({
     where: { nome: 'Solicitação de admissão' },
      select: { id: true },
    })

    const admissionTypeId = existingAdmissionByName?.id ?? 'SOLICITACAO_ADMISSAO'

    await prisma.tipoSolicitacao.upsert({
      where: { id: admissionTypeId },
      update: {
        codigo: 'RQ.DP.001',
        nome: 'Solicitação de admissão',
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            hiddenFromCreate: true,
          },
          camposEspecificos: [],
        },
        updatedAt: new Date(),
      },
      create: {
        id: 'SOLICITACAO_ADMISSAO',
        codigo: 'RQ.DP.001',
        nome: 'Solicitação de admissão',
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: {
          meta: {
            departamentos: [dpDepartment.id],
            hiddenFromCreate: true,
          },
          camposEspecificos: [],
        },        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "Solicitação de Admissão" ok.')
     const agendamentoFeriasSchema = {
      meta: {
        departamentos: [dpDepartment.id],
        categoria: 'SERVIÇOS DE DP',
        centroResponsavel: 'DEPARTAMENTO PESSOAL',
        autoApprove: true,
        requiresApproval: false,
      },
      camposEspecificos: [
        {
          name: 'matricula',
          label: 'Matrícula',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'nomeColaborador',
          label: 'Nome',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'cargoColaborador',
          label: 'Cargo',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'ccContrato',
          label: 'CC/Contrato',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'periodoAquisitivoInicio',
          label: 'Período Aquisitivo (Dt.Ini)',
          type: 'date',
          stage: 'solicitante',
          section: 'Período aquisitivo',
        },
        {
          name: 'periodoAquisitivoFim',
          label: 'Período Aquisitivo (Dt.Fim)',
          type: 'date',
          stage: 'solicitante',
          section: 'Período aquisitivo',
        },
        {
          name: 'inicioGozo',
          label: 'Início do Gozo',
          type: 'date',
          stage: 'solicitante',
          section: 'Gozo',
        },
        {
          name: 'qtdDiasCorridos',
          label: 'Qtd de dias (Corridos)',
          type: 'number',
          stage: 'solicitante',
          section: 'Gozo',
        },
        {
          name: 'fimGozo',
          label: 'Fim do Gozo',
          type: 'date',
          stage: 'solicitante',
          section: 'Gozo',
        },
        {
          name: 'dataRetorno',
          label: 'Dt de retorno (dia útil)',
          type: 'date',
          stage: 'solicitante',
          section: 'Gozo',
        },
        {
          name: 'abonoPecuniarioSim',
          label: 'Sim',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Abono Pecuniário',
        },
        {
          name: 'abonoPecuniarioNao',
          label: 'Não',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Abono Pecuniário',
        },
        {
          name: 'abonoDias',
          label: 'Qtd de dias (abono)',
          type: 'number',
          stage: 'solicitante',
          section: 'Abono Pecuniário',
        },
        {
          name: 'pagamentoAbonoQuando',
          label: 'Pagar quando?',
          type: 'select',
          options: ['Na folha do mês', 'Na folha seguinte', 'Outro'],
          stage: 'solicitante',
          section: 'Pagamento do Abono Pecuniário',
        },
        {
          name: 'anexosSolicitacao',
          label: 'Anexo(s) da Solicitação',
          type: 'text',
          stage: 'solicitante',
          section: 'Anexos',
        },
        {
          name: 'anexosSolicitante',
          label: 'Anexo(s) do Solicitante',
          type: 'text',
          stage: 'solicitante',
          section: 'Anexos',
        },
      ],
    }

     await prisma.tipoSolicitacao.upsert({
       where: { id: 'AGENDAMENTO_DE_FERIAS' },
      update: {
        codigo: 'RQ.DP.003',
        nome: 'Solicitação de férias',
        descricao: 'SERVIÇOS DE DP - agendamento de férias',
        schemaJson: agendamentoFeriasSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'AGENDAMENTO_DE_FERIAS',
        codigo: 'RQ.DP.003',
        nome: 'Solicitação de férias',
        descricao: 'SERVIÇOS DE DP - agendamento de férias',
        schemaJson: agendamentoFeriasSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "Solicitação de Férias" ok.')
    const desligamentoSchema = {
      meta: {
        departamentos: [dpDepartment.id],
        fluxo: {
          rhApproval: true,
          rhToDp: true,
          dpDepartmentCode: '08',
        },
      },
      camposEspecificos: [
        
        {
          name: 'motivoPedidoDemissao',
          label: 'Pedido de demissão',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'motivoSemJustaCausa',
          label: 'Sem justa causa',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'motivoJustaCausa',
          label: 'Justa causa',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'motivoTerminoExperiencia',
          label: 'Término de experiência',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'justificativaGestor',
          label: 'Justificativa do gestor (para sem/justa causa)',
          type: 'textarea',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'dataFimExperiencia',
          label: 'Data fim experiência',
          type: 'date',
          stage: 'solicitante',
          section: 'Motivo do desligamento',
        },
        {
          name: 'funcionarioNome',
          label: 'Nome do funcionário',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'funcionarioCargo',
          label: 'Cargo',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'funcionarioSetor',
          label: 'Setor',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'funcionarioCostCenterId',
          label: 'Centro de custo',
          type: 'cost_center',
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'dataSugeridaUltimoDia',
          label: 'Data sugerida do último dia',
          type: 'date',
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'cumpriraAviso',
          label: 'Funcionário cumprirá aviso?',
          type: 'select',
          options: ['Sim', 'Não'],
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'posicaoSubstituida',
          label: 'Posição vaga será substituída?',
          type: 'select',
          options: ['Sim', 'Não'],
          stage: 'solicitante',
          section: 'Dados do funcionário',
        },
        {
          name: 'rhDataExameDemissional',
          label: 'Data exame demissional',
          type: 'date',
          stage: 'rh',
          section: 'Informações gerais RH (preenchimento RH)',
        },
        {
          name: 'rhDataLiberacaoPpp',
          label: 'Data liberação PPP',
          type: 'date',
          stage: 'rh',
          section: 'Informações gerais RH (preenchimento RH)',
        },
        {
          name: 'rhConsideracoes',
          label: 'Considerações',
          type: 'textarea',
          stage: 'rh',
          section: 'Informações gerais RH (preenchimento RH)',
        },
        {
          name: 'dpDataDemissao',
          label: 'Data demissão',
          type: 'date',
          stage: 'dp',
          section: 'Informações gerais DP (preenchimento DP)',
        },
        {
          name: 'dpDataPrevistaAcerto',
          label: 'Data prevista acerto',
          type: 'date',
          stage: 'dp',
          section: 'Informações gerais DP (preenchimento DP)',
        },
        {
          name: 'dpConsideracoes',
          label: 'Considerações',
          type: 'textarea',
          stage: 'dp',
          section: 'Informações gerais DP (preenchimento DP)',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
       where: { id: 'RQ_247' },
      update: {
        codigo: 'RQ.DP.002',
        nome: 'Desligamento de pessoal',
        descricao: 'SERVIÇOS DE DP - desligamento de funcionário',
        schemaJson: desligamentoSchema,
        updatedAt: new Date(),
      },
     create: {
        id: 'RQ_247',
        codigo: 'RQ.DP.002',
        nome: 'Desligamento de pessoal',
        descricao: 'SERVIÇOS DE DP - desligamento de funcionário',
        schemaJson: desligamentoSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ_247 - Desligamento de Pessoal" ok.')
    

    const solicitacaoExamesSstSchema = {
      meta: {
        departamentos: [sstDepartment.id],
        categoria: 'SERVIÇOS DE SST',
        centroResponsavelLabel: 'SEGURANÇA DO TRABALHO',
        defaultSlaHours: 24,
        defaultPrioridade: 'MEDIA',
      },
      camposEspecificos: [
        {
          name: 'anexosSolicitacao',
          label: 'Anexo(s) Da Solicitação',
          type: 'file',
          required: false,
          stage: 'solicitante',
          section: 'Anexos',
        },
        {
          name: 'anexosSolicitante',
          label: 'Anexo(s) Do Solicitante',
          type: 'file',
          required: false,
          stage: 'solicitante',
          section: 'Anexos',
        },
        {
           name: 'nome',
          label: 'Nome',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'cpf',
          label: 'CPF',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'dataNascimento',
          label: 'Data de Nascimento',
          type: 'date',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'cidadeOndeReside',
          label: 'Cidade onde Reside',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'cargo',
          label: 'Cargo',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'telefone',
          label: 'Telefone',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
           name: 'email',
          label: 'E-mail',
          type: 'email',
          required: true,
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
           name: 'contratoMobilizadoOuDesmobilizado',
          label: 'Contrato a ser Mobilizado ou Desmobilizado',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'rg',
          label: 'RG',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'condutorVeiculo',
          label: 'Condutor de Veículo',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Formulário',
        },
        { name: 'admissional', label: 'Admissional', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
        { name: 'transferencia', label: 'Transferência', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
        { name: 'demissional', label: 'Demissional', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
        { name: 'mudancaFuncao', label: 'Mudança de função', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
        { name: 'retornoTrabalho', label: 'Retorno ao Trabalho', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
        { name: 'urgencia', label: 'Esse serviço tem urgência?', type: 'checkbox', stage: 'solicitante', section: 'Formulário' },
         ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_092' },
      update: {
        codigo: 'RQ.SST.002',
        nome: 'Solicitação de exames',
        descricao: 'Formulário para Solicitação de exames ao SST',
        schemaJson: solicitacaoExamesSstSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_092',
        codigo: 'RQ.SST.002',
        nome: 'Solicitação de exames',
        descricao: 'Formulário para Solicitação de exames ao SST',
        schemaJson: solicitacaoExamesSstSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.092 SOLICITAÇÃO DE EXAMES" ok.')
    const requisicaoEpiUniformesSchema = {
      meta: {
          departamentos: logisticaDepartment ? [logisticaDepartment.id] : [sstDepartment.id],
        categoria: 'SERVIÇOS DE LOGÍSTICA',
        centroResponsavelLabel: 'LOGÍSTICA',
        requiresApproval: true,
        destinoAposAprovacao: logisticaDepartment?.id,
        requiresAttachment: false,
      },
      camposEspecificos: [
        {
          name: 'disponibilidadeAtendimento',
          label: 'Estoque ou fornecimento imediato',
          type: 'select',
          options: ['ESTOQUE', 'FORNECIMENTO_IMEDIATO'],
          stage: 'solicitante',
          section: 'Dados da solicitação',
        },
        {
          name: 'funcionarioStatus',
          label: 'Funcionário novo ou antigo?',
          type: 'select',
          options: ['NOVO', 'ANTIGO'],
          stage: 'solicitante',
          section: 'Dados da solicitação',
        },
        {
          name: 'centroCustoId',
          label: 'Centro de Custo',
          type: 'cost_center',
          stage: 'solicitante',
          section: 'Dados da solicitação',
        },
        {
          name: 'funcionarioNome',
          label: 'Nome do funcionário',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados da solicitação',
        },
        {
          name: 'funcao',
          label: 'Função',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados da solicitação',
        },
        {
          name: 'camisa',
          label: 'Camisa',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados dos EPIs',
        },
        {
          name: 'calca',
          label: 'Calça',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados dos EPIs',
        },
        {
          name: 'bota',
          label: 'Bota',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados dos EPIs',
        },
        {
         name: 'entregaTipo',
          label: 'Retirar na sede ou será enviado',
          type: 'select',
          options: ['Retirar na sede', 'Será enviado'],
          stage: 'solicitante',
          section: 'Dados da entrega',
        },
        {
          name: 'enderecoEnvio',
          label: 'Endereço de envio',
          type: 'textarea',
          stage: 'solicitante',
          section: 'Dados da entrega',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_043' },
      update: {
        codigo: 'RQ.SST.001',
         nome: 'Requisição de EPI s/uniformes',
        descricao: 'Solicitação de EPI e uniformes com fluxo SST > aprovação > logística',
        schemaJson: requisicaoEpiUniformesSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_043',
        codigo: 'RQ.SST.001',
        nome: 'Requisição de EPI s/uniformes',
        descricao: 'Solicitação de EPI e uniformes com fluxo SST > aprovação > logística',
        schemaJson: requisicaoEpiUniformesSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.043 REQUISIÇÃO DE EPI S/UNIFORMES" ok.')
    const nadaConstaSchema = {
      meta: {
        departamentos: [dpDepartment.id],
        fluxo: {
          multiSetor: true,
        },
      },
      camposEspecificos: [
        {
          name: 'afastamento',
          label: 'Afastamento',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'demissao',
          label: 'Demissão',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
         name: 'funcionarioNome',
          label: 'Funcionário',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'funcao',
          label: 'Função',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'centroCusto',
          label: 'Centro de custo',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'matricula',
          label: 'Matrícula',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'contrato',
          label: 'Contrato',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'dataAcerto',
          label: 'Data do acerto',
          type: 'date',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'dataDemissao',
          label: 'Data de demissão',
          type: 'date',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'gestor',
          label: 'Gestor',
          type: 'text',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'observacoesSolicitante',
          label: 'Observações',
          type: 'textarea',
          stage: 'solicitante',
          section: 'Dados do colaborador',
        },
        {
          name: 'dpStatus',
          label: 'Status (Consta / Nada Consta)',
          type: 'select',
          options: ['Consta', 'Nada Consta'],
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpReembolsoValeTransporte',
          label: 'Reembolso - Vale Transporte',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpReembolsoValeRefeicao',
          label: 'Reembolso - Vale Refeição',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpValeTransporte',
          label: 'Vale Transporte',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpValeRefeicao',
          label: 'Vale Refeição',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpEmprestimoConsignado',
          label: 'Empréstimo Consignado',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpDescontoIpi',
          label: 'Desconto IPI',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpDescontoCracha',
          label: 'Desconto de Crachá',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpExcard',
          label: 'Excard',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpPensaoAlimenticia',
          label: 'Pensão Alimentícia',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpSeguroVida',
          label: 'Seguro de Vida',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpHoraExtra50',
          label: 'Hora Extra 50%',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpHoraExtra100',
          label: 'Hora Extra 100%',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpHoraExtraBancoHoras',
          label: 'Hora Extra Banco de Horas',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpAdicionalNoturno',
          label: 'Adicional Noturno',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpPlanoSaude',
          label: 'Plano Saúde',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpPlanoSaudeDependentes',
          label: 'Plano Saúde - Dep.',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpPlanoSaudeCopart',
          label: 'Plano Saúde - Copart.',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpPlanoOdontDependentes',
          label: 'Plano Odont - Dep.',
          type: 'text',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpObservacoes',
          label: 'Obs.',
          type: 'textarea',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
        {
          name: 'dpValorTotal',
          label: 'R$ (valor total)',
          type: 'number',
          stage: 'dp',
          section: 'Departamento Pessoal',
        },
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
        {
          name: 'almoxStatus',
          label: 'Status (Consta / Nada Consta)',
          type: 'select',
          options: ['Consta', 'Nada Consta'],
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade1',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem1',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor1',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade2',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem2',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor2',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade3',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem3',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor3',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade4',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem4',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor4',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade5',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem5',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor5',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxQuantidade6',
          label: 'Quantidade',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxItem6',
          label: 'EPI/EPC/Uniformes/Diversos',
          type: 'text',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValor6',
          label: 'R$',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxObs',
          label: 'Obs.',
          type: 'textarea',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'almoxValorTotal',
          label: 'R$ (valor total)',
          type: 'number',
          stage: 'almox',
          section: 'Almoxarifado',
        },
        {
          name: 'logStatus',
          label: 'Status (Consta / Nada Consta)',
          type: 'select',
          options: ['Consta', 'Nada Consta'],
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'logDevolucaoBoton',
          label: 'Devolução Boton / Cartão de Motorista',
          type: 'text',
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'logDevolucaoVeiculo',
          label: 'Devolução veículo locado',
          type: 'text',
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'logMultas',
          label: 'Possui Multas / Notificações',
          type: 'text',
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'logObs',
          label: 'Obs.',
          type: 'textarea',
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'logValorTotal',
          label: 'R$ (valor total)',
          type: 'number',
          stage: 'logistica',
          section: 'Logística',
        },
        {
          name: 'sstStatus',
          label: 'Status (Consta / Nada Consta)',
          type: 'select',
          options: ['Consta', 'Nada Consta'],
          stage: 'sst',
          section: 'SST',
        },
        {
          name: 'sstCliente',
          label: 'Cliente',
          type: 'checkbox',
          stage: 'sst',
          section: 'SST',
        },
        {
          name: 'sstPpp',
          label: 'PPP',
          type: 'text',
          stage: 'sst',
          section: 'SST',
        },
        {
          name: 'sstAso',
          label: 'ASO',
          type: 'text',
          stage: 'sst',
          section: 'SST',
        },
        {
          name: 'sstObs',
          label: 'Obs.',
          type: 'textarea',
          stage: 'sst',
          section: 'SST',
        },
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
          label: 'Obs.',
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
          label: 'Obs.',
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
        {
          name: 'anotacoesGerais',
          label: 'Anotações gerais',
          type: 'textarea',
          stage: 'fiscal',
          section: 'Fiscal',
        },
      ],
    }

     await prisma.tipoSolicitacao.upsert({
      where: { id: 'RQ_300' },
      update: {
        codigo: 'RQ.DP.007',
       nome: 'Nada consta',
        descricao: 'Solicitação de nada consta (Departamento Pessoal)',
        schemaJson: nadaConstaSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_300',
        codigo: 'RQ.DP.007',
        nome: 'Nada consta',
        descricao: 'Solicitação de nada consta (Departamento Pessoal)',
        schemaJson: nadaConstaSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.300 NADA CONSTA" ok.')
    const avaliacaoExperienciaSchema = {
      meta: {
        departamentos: [rhDepartment?.id].filter((value): value is string => Boolean(value)),
        requiresApproval: false,
      },
      camposEspecificos: [
        { name: 'colaboradorAvaliado', label: 'Colaborador avaliado', type: 'text', stage: 'solicitante', section: 'Dados' },
        { name: 'contratoSetor', label: 'Contrato/Setor', type: 'text', stage: 'solicitante', section: 'Dados' },
        { name: 'gestorImediatoAvaliador', label: 'Gestor imediato avaliador', type: 'text', stage: 'solicitante', section: 'Dados' },
        { name: 'cargoColaborador', label: 'Cargo do colaborador', type: 'text', stage: 'solicitante', section: 'Dados' },
        { name: 'dataAdmissao', label: 'Data de admissão', type: 'date', stage: 'solicitante', section: 'Dados' },
        { name: 'cargoAvaliador', label: 'Cargo do avaliador', type: 'text', stage: 'solicitante', section: 'Dados' },
        ...[
          'relacionamentoNota', 'comunicacaoNota', 'atitudeNota', 'saudeSegurancaNota',
          'dominioTecnicoProcessosNota', 'adaptacaoMudancaNota', 'autogestaoGestaoPessoasNota',
        ].map((name) => ({
          name,
          label: name,
          type: 'select',
          options: ['INSUFICIENTE', 'PARCIAL', 'PLENA', 'ACIMA DA MÉDIA'],
          stage: 'solicitante',
          section: 'Avaliação',
        })),
        { name: 'comentarioFinal', label: 'Comentário final', type: 'textarea', stage: 'solicitante', section: 'Comentários' },
      ],
    }

    await prisma.tipoSolicitacao.update({ where: { id: 'RQ_RH_103' }, data: { schemaJson: avaliacaoExperienciaSchema, updatedAt: new Date() } })

    await prisma.tipoSolicitacao.update({
      where: { id: 'RQ_106' },
      data: {
        schemaJson: {
          meta: { departamentos: [dpDepartment.id], requiresApproval: false },
          camposEspecificos: [
            { name: 'nomeSolicitante', label: 'Nome do solicitante', type: 'text', required: true, stage: 'solicitante', section: 'Dados' },
            { name: 'cpf', label: 'CPF', type: 'text', required: true, stage: 'solicitante', section: 'Dados' },
            { name: 'observacoes', label: 'Observações', type: 'textarea', stage: 'solicitante', section: 'Dados' },
            { name: 'anexosSolicitante', label: 'Anexos do solicitante', type: 'file', required: true, stage: 'solicitante', section: 'Anexos' },
          ],
        },
        updatedAt: new Date(),
      },
    })

    await prisma.tipoSolicitacao.update({
      where: { id: 'RQ_115' },
      data: {
        schemaJson: {
          meta: { departamentos: [dpDepartment.id], requiresApproval: false },
          camposEspecificos: [
            { name: 'anexosSolicitante', label: 'Carta de próprio punho (anexo)', type: 'file', required: true, stage: 'solicitante', section: 'Anexos' },
            { name: 'nome', label: 'Nome', type: 'text', required: true, stage: 'solicitante', section: 'Dados' },
            { name: 'cpf', label: 'CPF', type: 'text', required: true, stage: 'solicitante', section: 'Dados' },
            { name: 'renunciaValeTransporte', label: 'Renúncia vale transporte', type: 'checkbox', stage: 'solicitante', section: 'Benefícios' },
            { name: 'renunciaPlanoOdontologico', label: 'Renúncia plano odontológico', type: 'checkbox', stage: 'solicitante', section: 'Benefícios' },
            { name: 'renunciaPlanoMedico', label: 'Renúncia plano médico', type: 'checkbox', stage: 'solicitante', section: 'Benefícios' },
            { name: 'renunciaOutros', label: 'Outros', type: 'text', stage: 'solicitante', section: 'Benefícios' },
          ],
        },
        updatedAt: new Date(),
      },
    })

    await prisma.tipoSolicitacao.update({
      where: { id: 'RQ_240' },
      data: {
        nome: 'Transferência / mobilização entre centros de custo',
        schemaJson: {
          meta: { departamentos: [dpDepartment.id], requiresApproval: false },
          camposEspecificos: [
            { name: 'anexosSolicitante', label: 'Anexos do solicitante', type: 'file', stage: 'solicitante', section: 'Anexos' },
            { name: 'anexosSolicitacao', label: 'Anexos da solicitação', type: 'file', stage: 'solicitante', section: 'Anexos' },
            { name: 'itens', label: 'Colaboradores (JSON)', type: 'textarea', required: true, stage: 'solicitante', section: 'Colaboradores' },
            { name: 'centroCustoDestinoId', label: 'Centro de custo destino', type: 'cost_center', required: true, stage: 'solicitante', section: 'Destino' },
            { name: 'dataInicio', label: 'Data início', type: 'date', stage: 'solicitante', section: 'Período' },
            { name: 'dataFim', label: 'Data fim', type: 'date', stage: 'solicitante', section: 'Período' },
            { name: 'motivoTransferencia', label: 'Motivo da transferência', type: 'textarea', required: true, stage: 'solicitante', section: 'Motivo' },
            { name: 'alterouJornada', label: 'Alterou jornada?', type: 'select', options: ['SIM', 'NÃO'], stage: 'solicitante', section: 'Motivo' },
            { name: 'requerTreinamentosObrigatorios', label: 'Requer treinamentos obrigatórios', type: 'checkbox', stage: 'solicitante', section: 'SST' },
            { name: 'quaisTreinamentos', label: 'Quais treinamentos', type: 'text', stage: 'solicitante', section: 'SST' },
            { name: 'requerEpisEspecificos', label: 'Requer EPIs específicos', type: 'checkbox', stage: 'solicitante', section: 'SST' },
            { name: 'quaisEpis', label: 'Quais EPIs', type: 'text', stage: 'solicitante', section: 'SST' },
            { name: 'requerExamesComplementares', label: 'Requer exames complementares', type: 'checkbox', stage: 'solicitante', section: 'SST' },
            { name: 'quaisExames', label: 'Quais exames', type: 'text', stage: 'solicitante', section: 'SST' },
            { name: 'transferirVeiculo', label: 'Transferir veículo', type: 'checkbox', stage: 'solicitante', section: 'Logística' },
            { name: 'placaDescricaoVeiculo', label: 'Placa/Descrição veículo', type: 'text', stage: 'solicitante', section: 'Logística' },
            { name: 'transferirEquipamento', label: 'Transferir equipamento', type: 'checkbox', stage: 'solicitante', section: 'Almoxarifado' },
            { name: 'patrimonioDescricaoEquipamento', label: 'Patrimônio/Descrição equipamento', type: 'text', stage: 'solicitante', section: 'Almoxarifado' },
            { name: 'transferirEquipamentoTI', label: 'Transferir equipamento TI', type: 'checkbox', stage: 'solicitante', section: 'TI' },
            { name: 'descricaoEquipamentoTI', label: 'Marca-Modelo + Patrimônio', type: 'text', stage: 'solicitante', section: 'TI' },
            { name: 'numeroLinhaModeloAparelhoPatrimonio', label: 'Número linha/modelo/aparelho/patrimônio', type: 'text', stage: 'solicitante', section: 'TI' },
          ],
        },
        updatedAt: new Date(),
      },
    })
  }

  /* =========================
     CONTROLE DE ACESSO
     ========================= */

  async function ensureModule(key: string, name: string) {
    const existing = await prisma.module.findUnique({ where: { key } })
    if (existing) {
      return prisma.module.update({
        where: { id: existing.id },
        data: { name },
      })
    }

    const caseInsensitive = await prisma.module.findFirst({
      where: { key: { equals: key } },
    })
    if (caseInsensitive) {
      return prisma.module.update({
        where: { id: caseInsensitive.id },
        data: { name },
      })
    }

    return prisma.module.create({ data: { key, name } })
  }

  const solicitacoesModule = await ensureModule(MODULE_KEYS.SOLICITACOES, 'Solicitações')
  const configModule = await ensureModule(MODULE_KEYS.CONFIGURACOES, 'Configurações')
  const fleetModule = await ensureModule(MODULE_KEYS.FROTAS, 'Gestão de Frotas')
  const refusalModule = await ensureModule(MODULE_KEYS.RECUSA, 'Direito de Recusa')
  const celularModule = await ensureModule(MODULE_KEYS.CELULAR, 'Celular')
  const meusDocumentosModule = await ensureModule(MODULE_KEYS.MEUS_DOCUMENTOS, 'Meus documentos')
  const sstModule = await ensureModule(MODULE_KEYS.SST, 'Não Conformidades')
  const equipmentsModule = await ensureModule(
    MODULE_KEYS.EQUIPAMENTOS_TI,
    'Controle de Equipamentos TI',
  )

 const allModules = [
    solicitacoesModule,
    configModule,
    fleetModule,
    refusalModule,
    celularModule,
    equipmentsModule,
    meusDocumentosModule,
    sstModule,
  ]


  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: 'Administradores' },
    update: {},
    create: { name: 'Administradores', notes: 'Acesso total ao sistema' },
  })
  const buildNestedActions = (actions: Action[]) => ({
    create: actions.map((action) => ({ action })),
  })


  const upsertAccessGroupGrant = async (params: {
    groupId: string
    moduleId: string
    actions: Action[]
  }) => {
    const { groupId, moduleId, actions } = params

    try {
      return await prisma.accessGroupGrant.upsert({
        where: { groupId_moduleId: { groupId, moduleId } },
        create: {
          groupId,
          moduleId,
          actions: actions as any,
        },
        update: {
          actions: actions as any,
        },
      })
    } catch {
      const nestedActions = buildNestedActions(actions)

      return prisma.accessGroupGrant.upsert({
        where: { groupId_moduleId: { groupId, moduleId } },
        create: {
          groupId,
          moduleId,
          actions: nestedActions as any,
        },
        update: {
          actions: {
            deleteMany: {},
            ...nestedActions,
          } as any,
        },
      })
    }
  }
  const upsertFeatureGrant = async (params: {
    groupId: string
    featureId: string
    actions: Action[]
  }) => {
    const { groupId, featureId, actions } = params

    try {
      return await prisma.featureGrant.upsert({
        where: { groupId_featureId: { groupId, featureId } },
        create: {
          groupId,
          featureId,
          actions: actions as any,
        },
        update: {
          actions: actions as any,
        },
      })
    } catch {
      const nestedActions = buildNestedActions(actions)

      return prisma.featureGrant.upsert({
        where: { groupId_featureId: { groupId, featureId } },
        create: {
          groupId,
          featureId,
          actions: nestedActions as any,
        },
        update: {
          actions: {
            deleteMany: {},
            ...nestedActions,
          } as any,
        },
      })
    }
  }

  for (const mod of allModules) {
    await upsertAccessGroupGrant({ groupId: adminGroup.id, moduleId: mod.id, actions: ALL_ACTIONS })
  }

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: superAdminUser.id, groupId: adminGroup.id } },
    update: {},
    create: { userId: superAdminUser.id, groupId: adminGroup.id, role: 'MANAGER' },
  })

     const systemModules = await prisma.module.findMany({
    select: { id: true, key: true },
  })


  for (const mod of systemModules) {
    await prisma.userModuleAccess.upsert({
      where: { userId_moduleId: { userId: superAdminUser.id, moduleId: mod.id } },
      update: { level: ModuleLevel.NIVEL_3 },
      create: { userId: superAdminUser.id, moduleId: mod.id, level: ModuleLevel.NIVEL_3 },
    })
  }

  const tiGroup = await prisma.accessGroup.upsert({
    where: { name: 'Tecnologia da Informação' },
    update: {},
    create: { name: 'Tecnologia da Informação', notes: 'Grupo do TI' },
  })

  await upsertAccessGroupGrant({
    groupId: tiGroup.id,
    moduleId: configModule.id,
    actions: ['VIEW', 'CREATE', 'UPDATE'],
  })

  const rq063ApproversGroup = await prisma.accessGroup.upsert({
    where: { name: 'Aprovadores RQ_063' },
    update: {},
    create: { name: 'Aprovadores RQ_063', notes: 'Gestores que podem aprovar a RQ_063' },
  })

  await upsertAccessGroupGrant({
    groupId: rq063ApproversGroup.id,
    moduleId: solicitacoesModule.id,
    actions: ['VIEW', 'APPROVE'],
  })

  const safetyDepartment = await prisma.department.findUnique({ where: { code: '19' } })
  if (safetyDepartment) {
    await prisma.departmentModule.upsert({
      where: { departmentId_moduleId: { departmentId: safetyDepartment.id, moduleId: refusalModule.id } },
      update: {},
      create: { departmentId: safetyDepartment.id, moduleId: refusalModule.id },
    })
  }

  await prisma.departmentModule.upsert({
    where: { departmentId_moduleId: { departmentId: tiDepartment.id, moduleId: equipmentsModule.id } },
    update: {},
    create: { departmentId: tiDepartment.id, moduleId: equipmentsModule.id },
  })

  await prisma.departmentModule.upsert({
    where: { departmentId_moduleId: { departmentId: tiDepartment.id, moduleId: meusDocumentosModule.id } },
    update: {},
    create: { departmentId: tiDepartment.id, moduleId: meusDocumentosModule.id },
  })
  /* =========================
     FEATURES E GRANTS POR FEATURE
     ========================= */
   type ModuleFeatures = { moduleId: string; items: { key: string; name: string }[] }

  const featureCatalog: ModuleFeatures[] = [
    {
      moduleId: configModule.id,
      items: [
        { key: FEATURE_KEYS.CONFIGURACOES.PAINEL, name: 'Painel de Configurações' },
        { key: FEATURE_KEYS.CONFIGURACOES.USUARIOS, name: 'Usuários' },
        { key: FEATURE_KEYS.CONFIGURACOES.PERMISSOES, name: 'Permissões' },
        { key: FEATURE_KEYS.CONFIGURACOES.CENTROS_DE_CUSTO, name: 'Centros de Custo' },
        { key: FEATURE_KEYS.CONFIGURACOES.CARGOS, name: 'Cargos' },
      ],
    },
    {
      moduleId: solicitacoesModule.id,
      items: [
        { key: FEATURE_KEYS.SOLICITACOES.ENVIADAS, name: 'Solicitações Enviadas' },
        { key: FEATURE_KEYS.SOLICITACOES.RECEBIDAS, name: 'Solicitações Recebidas' },
        { key: FEATURE_KEYS.SOLICITACOES.APROVACAO, name: 'Aprovação de Solicitações' },
        { key: FEATURE_KEYS.SOLICITACOES.CADASTROS, name: 'Cadastros' },
        { key: FEATURE_KEYS.SOLICITACOES.FLUXOS, name: 'Fluxo de Solicitações' },
      ],
    },
    {
      moduleId: fleetModule.id,
      items: [
        { key: FEATURE_KEYS.FROTAS.VEICULOS, name: 'Veículos' },
        { key: FEATURE_KEYS.FROTAS.CHECKINS, name: 'Check-ins' },
        { key: FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN, name: 'Check-in de deslocamento' },
        { key: FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL, name: 'Painel de deslocamento' },
      ],
    },
    {
      moduleId: refusalModule.id,
      items: [
        { key: FEATURE_KEYS.RECUSA.PAINEL, name: 'Painel de Direito de Recusa' },
        { key: FEATURE_KEYS.RECUSA.MINHAS, name: 'Minhas recusas' },
        { key: FEATURE_KEYS.RECUSA.NOVA, name: 'Registrar recusa' },
        { key: FEATURE_KEYS.RECUSA.PENDENTES, name: 'Pendentes para avaliar' },
      ],
    },
    {
      moduleId: equipmentsModule.id,
      items: [
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.ATALHO, name: 'Atalho de controle rápido' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.LINHA_TELEFONICA, name: 'Linhas telefônicas' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.SMARTPHONE, name: 'Smartphones' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.NOTEBOOK, name: 'Notebooks' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.DESKTOP, name: 'Desktops' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.MONITOR, name: 'Monitores' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.IMPRESSORA, name: 'Impressoras' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.TPLINK, name: 'TP-Link' },
        { key: FEATURE_KEYS.EQUIPAMENTOS_TI.OUTROS, name: 'Outros equipamentos' },
      ],
    },
    {
      moduleId: meusDocumentosModule.id,
      items: [
        { key: FEATURE_KEYS.MEUS_DOCUMENTOS.LISTAR, name: 'Listar documentos' },
        { key: FEATURE_KEYS.MEUS_DOCUMENTOS.VISUALIZAR, name: 'Visualizar documentos' },
        { key: FEATURE_KEYS.MEUS_DOCUMENTOS.ASSINAR, name: 'Assinar documentos' },
      ],
    },
     {
      moduleId: sstModule.id,
      items: [
        { key: FEATURE_KEYS.SST.NAO_CONFORMIDADES, name: 'Não conformidades' },
      ],
    },
  ]

  for (const catalog of featureCatalog) {
    for (const item of catalog.items) {
      await prisma.moduleFeature.upsert({
        where: {
          moduleId_key: {
            moduleId: catalog.moduleId,
            key: item.key,
          },
        },
        update: { name: item.name },
        create: {
          key: item.key,
          name: item.name,
          moduleId: catalog.moduleId,
        },
      })
    }
  }

  const allSystemFeatures = await prisma.moduleFeature.findMany({
    select: { id: true },
  })

  for (const feature of allSystemFeatures) {
    await upsertFeatureGrant({
      groupId: adminGroup.id,
      featureId: feature.id,
      actions: ALL_ACTIONS,
    })

    await prisma.featureLevelGrant.upsert({
      where: {
        featureId_level: {
          featureId: feature.id,
          level: ModuleLevel.NIVEL_3,
        },
      },
      create: {
        featureId: feature.id,
        level: ModuleLevel.NIVEL_3,
        actions: {
          create: ALL_ACTIONS.map((action) => ({ action })),
        },
      },
      update: {
        actions: {
          deleteMany: {},
          create: ALL_ACTIONS.map((action) => ({ action })),
        },
      },
    })
  }



  const tiposToNormalize = await prisma.tipoSolicitacao.findMany({
    select: { id: true, schemaJson: true },
  })

  for (const tipo of tiposToNormalize) {
    const schema = (tipo.schemaJson ?? {}) as Record<string, any>
    const campos = Array.isArray(schema.camposEspecificos)
      ? schema.camposEspecificos
      : Array.isArray(schema.campos)
        ? schema.campos
        : []

    let changed = false
    const normalizedCampos = campos.map((campo: any) => {
      const name = String(campo?.name ?? '')
      const lowered = name.toLowerCase()
      const shouldBeCostCenter =
        campo?.type === 'cost_center' ||
        lowered.includes('centrocusto') ||
        lowered.includes('costcenter')

      if (shouldBeCostCenter && campo?.type !== 'cost_center') {
        changed = true
        return { ...campo, type: 'cost_center' }
      }

      return campo
    })

    if (!changed) continue

    await prisma.tipoSolicitacao.update({
      where: { id: tipo.id },
      data: {
        schemaJson: {
          ...schema,
          camposEspecificos: normalizedCampos,
        },
      },
    })
  }




  console.log('✅ Features e permissões por feature cadastradas.')
  const requiredIsoTables = [
    'DocumentTypeCatalog',
    'ApproverGroup',
    'DocumentTypeApprovalFlow',
    'DocumentResponsibilityTerm',
  ]
  const missingIsoTables: string[] = []

  for (const table of requiredIsoTables) {
    if (!(await hasTable(table))) {
      missingIsoTables.push(table)
    }

  }

   if (missingIsoTables.length > 0) {
    console.warn(
      `⚠️ Seed do módulo ISO ignorada. Tabelas ausentes: ${missingIsoTables.join(', ')}. Execute as migrations do módulo ISO para habilitar esta etapa.`,
    )
  } else {
    const isoPrisma = prisma as any
    const documentTypes = ['MAN', 'RQ', 'DA', 'PG', 'IT', 'POL', 'DD', 'COD', 'DOCEXT', 'LEG']
    for (const code of documentTypes) {
      await isoPrisma.documentTypeCatalog.upsert({
        where: { code },
        update: { description: `Tipo ${code}` },
        create: { code, description: `Tipo ${code}` },
      })
    }

   const qualityDepartment = await prisma.department.findUnique({ where: { code: '16' } })
    const sigDepartment = await prisma.department.findUnique({ where: { code: '18' } })

    const qualityGroup =
      (await isoPrisma.approverGroup.findFirst({ where: { name: 'QUALIDADE', departmentId: qualityDepartment?.id } })) ??
      (await isoPrisma.approverGroup.create({ data: { name: 'QUALIDADE', departmentId: qualityDepartment?.id } }))

    const sigGroup =
      (await isoPrisma.approverGroup.findFirst({ where: { name: 'SIG', departmentId: sigDepartment?.id } })) ??
      (await isoPrisma.approverGroup.create({ data: { name: 'SIG', departmentId: sigDepartment?.id } }))

    const genericApproval =
      (await isoPrisma.approverGroup.findFirst({ where: { name: 'APROVAÇÃO', departmentId: null } })) ??
      (await isoPrisma.approverGroup.create({ data: { name: 'APROVAÇÃO' } }))

    const allCatalogTypes = await isoPrisma.documentTypeCatalog.findMany()
    for (const type of allCatalogTypes) {
      await isoPrisma.documentTypeApprovalFlow.deleteMany({ where: { documentTypeId: type.id } })
      await isoPrisma.documentTypeApprovalFlow.createMany({
        data: [
          { documentTypeId: type.id, order: 1, stepType: 'REVIEW', approverGroupId: genericApproval.id, active: true },
          { documentTypeId: type.id, order: 2, stepType: 'QUALITY', approverGroupId: qualityGroup.id, active: true },
          { documentTypeId: type.id, order: 3, stepType: 'SIG', approverGroupId: sigGroup.id, active: true },
        ],
      })
    }

    await isoPrisma.documentResponsibilityTerm.upsert({
      where: { id: 'default-iso-term' },
      update: {
        title: 'Termo de Responsabilidade pelo uso e divulgação de documentos',
        active: true,
      },
      create: {
        id: 'default-iso-term',
        title: 'Termo de Responsabilidade pelo uso e divulgação de documentos',
        content:
          'Declaro que estou ciente das responsabilidades pelo uso e divulgação dos documentos do SGI, comprometendo-me com confidencialidade e uso adequado.',
        active: true,
      },
    })

    console.log('✅ Seed do módulo ISO aplicada.')
  }


  console.log('🎉 Seed concluído com sucesso!')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ Erro ao executar seed:', e)
  process.exit(1)
})