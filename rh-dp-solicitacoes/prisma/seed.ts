/* prisma/seed.ts */

import { Action, ModuleLevel, PrismaClient, UserStatus } from '@prisma/client'
import { ALL_ACTIONS, FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
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
      create: { code: d.code, name: d.name },
    })
  }
  console.log('✅ Departamentos cadastrados.')

  const tiDepartment = await prisma.department.findUnique({
    where: { code: '20' },
  })
  if (!tiDepartment) throw new Error('Departamento TI (code=20) não encontrado.')

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

  /* =========================
     TIPOS DE SOLICITAÇÃO BÁSICOS
     ========================= */
  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Vale-transporte' },
    update: {},
    create: {
      id: randomUUID(),
      nome: 'Vale-transporte',
      descricao: 'Inclusão/alteração de rotas de vale-transporte',
      schemaJson: {
        meta: { centros: [], departamentos: [] },
        camposEspecificos: [
          { name: 'linha', label: 'Linha de ônibus', type: 'text', required: true },
          { name: 'empresa', label: 'Empresa de transporte', type: 'text' },
          { name: 'valor', label: 'Valor mensal estimado', type: 'number' },
        ],
      },
      updatedAt: new Date(),
    },
  })
  console.log('✅ Tipo "Vale-transporte" ok.')
  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'SOLICITAÇÃO DE EQUIPAMENTO' },
    update: {
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
      id: 'SOLICITACAO_EQUIPAMENTO',
      nome: 'SOLICITAÇÃO DE EQUIPAMENTO',
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
  console.log('✅ Tipo "SOLICITAÇÃO DE EQUIPAMENTO" ok.')

  /* =========================
     DP: Solicitação de Admissão
     ========================= */
  if (dpDepartment) {
    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'Solicitação de Admissão' },
      update: {
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: { meta: { departamentos: [dpDepartment.id] }, camposEspecificos: [] },
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        nome: 'Solicitação de Admissão',
        descricao: 'Solicitação de admissão (Departamento Pessoal)',
        schemaJson: { meta: { departamentos: [dpDepartment.id] }, camposEspecificos: [] },
        updatedAt: new Date(),
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
      where: { nome: 'AGENDAMENTO DE FÉRIAS' },
      update: {
        descricao: 'SERVIÇOS DE DP - agendamento de férias',
        schemaJson: agendamentoFeriasSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'AGENDAMENTO_DE_FERIAS',
        nome: 'AGENDAMENTO DE FÉRIAS',
        descricao: 'SERVIÇOS DE DP - agendamento de férias',
        schemaJson: agendamentoFeriasSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "AGENDAMENTO DE FÉRIAS" ok.')
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
          name: 'gestorNome',
          label: 'Nome do gestor solicitante',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Dados do gestor solicitante',
        },
        {
          name: 'gestorCargo',
          label: 'Cargo do gestor solicitante',
          type: 'text',
          required: true,
          stage: 'solicitante',
          section: 'Dados do gestor solicitante',
        },
        {
          name: 'gestorData',
          label: 'Data',
          type: 'date',
          required: true,
          stage: 'solicitante',
          section: 'Dados do gestor solicitante',
        },
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
          name: 'funcionarioCentroCusto',
          label: 'Centro de custo (texto)',
          type: 'text',
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
      where: { nome: 'RQ.247 SOLICITAÇÃO DE DESLIGAMENTO DE PESSOAL' },
      update: {
        descricao: 'SERVIÇOS DE DP - desligamento de funcionário',
        schemaJson: desligamentoSchema,
        updatedAt: new Date(),
      },
     create: {
        id: 'RQ_247',
        nome: 'RQ.247 SOLICITAÇÃO DE DESLIGAMENTO DE PESSOAL',
        descricao: 'SERVIÇOS DE DP - desligamento de funcionário',
        schemaJson: desligamentoSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.247 SOLICITAÇÃO DE DESLIGAMENTO DE PESSOAL" ok.')
    

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
          type: 'text',
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
      where: { nome: 'RQ.092 SOLICITAÇÃO DE EXAMES' },
      update: {
        descricao: 'Formulário para Solicitação de exames ao SST',
        schemaJson: solicitacaoExamesSstSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_092',
        nome: 'RQ.092 SOLICITAÇÃO DE EXAMES',
        descricao: 'Formulário para Solicitação de exames ao SST',
        schemaJson: solicitacaoExamesSstSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.092 SOLICITAÇÃO DE EXAMES" ok.')
    const requisicaoEpiUniformesSchema = {
      meta: {
        departamentos: [sstDepartment.id],
        categoria: 'SERVIÇOS DE LOGÍSTICA',
        centroResponsavelLabel: 'SEGURANÇA DO TRABALHO',
        requiresApproval: true,
      },
      camposEspecificos: [
        {
          name: 'estoque',
          label: 'Estoque',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'fornecimentoImediato',
          label: 'Fornecimento Imediato',
          type: 'checkbox',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'centroCusto',
          label: 'Centro de Custo',
           type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'funcionario',
          label: 'Funcionário',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'funcao',
          label: 'Função',
          type: 'text',
          stage: 'solicitante',
          section: 'Formulário',
        },
        {
          name: 'camisa',
          label: 'Camisa',
          type: 'text',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'calca',
          label: 'Calça',
          type: 'text',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'bota',
          label: 'Bota',
          type: 'text',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'emailSolicitante',
          label: 'Email do solicitante',
          type: 'text',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'observacao',
          label: 'Observação',
           type: 'textarea',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'comoSeraEntrega',
          label: 'Como será a entrega?',
          type: 'select',
          options: ['Retirar na sede', 'Será enviado'],
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'enderecoEnvio',
          label: 'Informar endereço de envio',
          type: 'textarea',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'local',
          label: 'Local',
          type: 'text',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
        {
          name: 'data',
          label: 'Data',
          type: 'date',
          stage: 'solicitante',
          section: 'PREENCHIMENTO RH',
        },
      ],
    }

    await prisma.tipoSolicitacao.upsert({
      where: { nome: 'RQ.043 REQUISIÇÃO DE EPI S/UNIFORMES' },
      update: {
        descricao: 'Solicitação de EPI e uniformes com fluxo SST > aprovação > logística',
        schemaJson: requisicaoEpiUniformesSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_043',
        nome: 'RQ.043 REQUISIÇÃO DE EPI S/UNIFORMES',
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
          name: 'funcionario',
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
      where: { nome: 'RQ.300 NADA CONSTA' },
      update: {
        descricao: 'Solicitação de nada consta (Departamento Pessoal)',
        schemaJson: nadaConstaSchema,
        updatedAt: new Date(),
      },
      create: {
        id: 'RQ_300',
        nome: 'RQ.300 NADA CONSTA',
        descricao: 'Solicitação de nada consta (Departamento Pessoal)',
        schemaJson: nadaConstaSchema,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Tipo "RQ.300 NADA CONSTA" ok.')
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



  console.log('✅ Features e permissões por feature cadastradas.')
  const documentTypes = ['MAN', 'RQ', 'DA', 'PG', 'IT', 'POL', 'DD', 'COD', 'DOCEXT', 'LEG']
  for (const code of documentTypes) {
    await prisma.documentTypeCatalog.upsert({
      where: { code },
      update: { description: `Tipo ${code}` },
      create: { code, description: `Tipo ${code}` },
    })
  }

  const qualityDepartment = await prisma.department.findUnique({ where: { code: '16' } })
  const sigDepartment = await prisma.department.findUnique({ where: { code: '18' } })

  const qualityGroup =
    (await prisma.approverGroup.findFirst({ where: { name: 'QUALIDADE', departmentId: qualityDepartment?.id } })) ??
    (await prisma.approverGroup.create({ data: { name: 'QUALIDADE', departmentId: qualityDepartment?.id } }))

  const sigGroup =
    (await prisma.approverGroup.findFirst({ where: { name: 'SIG', departmentId: sigDepartment?.id } })) ??
    (await prisma.approverGroup.create({ data: { name: 'SIG', departmentId: sigDepartment?.id } }))

  const genericApproval =
    (await prisma.approverGroup.findFirst({ where: { name: 'APROVAÇÃO', departmentId: null } })) ??
    (await prisma.approverGroup.create({ data: { name: 'APROVAÇÃO' } }))

  const allCatalogTypes = await prisma.documentTypeCatalog.findMany()
  for (const type of allCatalogTypes) {
    await prisma.documentTypeApprovalFlow.deleteMany({ where: { documentTypeId: type.id } })
    await prisma.documentTypeApprovalFlow.createMany({
      data: [
        { documentTypeId: type.id, order: 1, stepType: 'REVIEW', approverGroupId: genericApproval.id, active: true },
        { documentTypeId: type.id, order: 2, stepType: 'QUALITY', approverGroupId: qualityGroup.id, active: true },
        { documentTypeId: type.id, order: 3, stepType: 'SIG', approverGroupId: sigGroup.id, active: true },
      ],
    })
  }

  await prisma.documentResponsibilityTerm.upsert({
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


  console.log('🎉 Seed concluído com sucesso!')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ Erro ao executar seed:', e)
  process.exit(1)
})
