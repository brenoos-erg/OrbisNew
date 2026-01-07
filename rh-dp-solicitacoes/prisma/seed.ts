/* prisma/seed.ts */

import { randomUUID } from 'crypto'
import { Action, ModuleLevel, PrismaClient, UserStatus } from '@prisma/client'
import { ALL_ACTIONS, FEATURE_KEYS, MODULE_KEYS } from '@/lib/featureKeys'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  let page = 1

  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)

    const found = (data?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === target)
    if (found?.id) return found.id

    if (!data?.users || data.users.length < perPage) break
    page++
  }

  return null
}

async function ensureAuthUser(
  admin: SupabaseClient,
  opts: { email: string; password: string; metadata?: Record<string, any> },
): Promise<string | null> {
  const { email, password, metadata } = opts
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (!error) return data.user?.id ?? null

const normalizedMessage = error.message?.toLowerCase() ?? ''
  const conflict =
    error.code === 'email_exists' ||
    normalizedMessage.includes('already exist') ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('email rate limit')

  if (!conflict) throw error

  const existingId = await findAuthUserIdByEmail(admin, email)
  if (!existingId) {
    console.warn(
      '⚠️  Conta já existe no Supabase Auth, mas não foi possível localizar o authId para:',
      email,
    )
    return null
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(existingId, {
    email,
    password,
    user_metadata: metadata,
  })
  if (updateErr) throw updateErr

  return existingId
}


async function main() {
  console.log('🌱 Iniciando seed...')

  // 1) Validar DIRECT_DATABASE_URL
  if (!process.env.DIRECT_DATABASE_URL) {
    console.error('❌ DIRECT_DATABASE_URL não está definido no .env')
    console.error('➡️ Coloque no seu .env algo como:')
    console.error(
      'DIRECT_DATABASE_URL="postgresql://postgres:***@db.SEUPROJETO.supabase.co:5432/postgres?schema=public"',
    )
    process.exit(1)
  }

  // 2) Forçar Prisma Client a usar DIRECT, mesmo que DATABASE_URL seja pooler
  const beforeHost = hostOf(process.env.DATABASE_URL)
  const directHost = hostOf(process.env.DIRECT_DATABASE_URL)

  process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL

  const afterHost = hostOf(process.env.DATABASE_URL)

  console.log('🔎 Host DATABASE_URL (antes):', beforeHost)
  console.log('🔎 Host DIRECT_DATABASE_URL :', directHost)
  console.log('✅ Host DATABASE_URL (agora):', afterHost)

  if (afterHost !== directHost) {
    console.error('❌ Falha ao forçar DATABASE_URL para DIRECT_DATABASE_URL')
    process.exit(1)
  }

  // 3) Agora sim cria o PrismaClient
  const prisma = new PrismaClient()
  const supabaseAdmin = getSupabaseAdmin()

  

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

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@ergengenharia.com.br' },
    update: {
      departmentId: tiDepartment.id,
      role: 'ADMIN',
      status: UserStatus.ATIVO,
    },
    create: {
      login: 'superadmin',
      fullName: 'Super Administrador',
      email: 'superadmin@ergengenharia.com.br',
      phone: '',
      status: UserStatus.ATIVO,
      role: 'ADMIN',
      departmentId: tiDepartment.id,
    },
  })
  console.log('✅ Usuário super admin criado/atualizado:', superAdminUser.email)
  if (supabaseAdmin) {
    const defaultPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123'

    const authId = await ensureAuthUser(supabaseAdmin, {
      email: superAdminUser.email,
      password: defaultPassword,
      metadata: {
        fullName: superAdminUser.fullName,
        login: superAdminUser.login,
        phone: superAdminUser.phone,
        role: superAdminUser.role,
      },
    })

    if (authId) {
      await prisma.user.update({
        where: { id: superAdminUser.id },
        data: { authId },
      })
      console.log('🔐 Usuário super admin sincronizado no Supabase Auth com authId:', authId)
      console.log('   ➡️  Email:', superAdminUser.email)
      console.log('   ➡️  Senha padrão:', defaultPassword)
    } else {
      console.warn('⚠️  Não foi possível obter authId para o super admin.')
    }
  } else {
    console.warn('⚠️  Supabase Admin não configurado (SUPABASE_SERVICE_ROLE_KEY ausente); pulando criação no Auth.')
  }


  const rhDepartment = await prisma.department.findUnique({ where: { code: '17' } })
  const dpDepartment = await prisma.department.findUnique({ where: { code: '08' } })

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
      where: { key: { equals: key, mode: 'insensitive' } },
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
  const equipmentsModule = await ensureModule(
    MODULE_KEYS.EQUIPAMENTOS_TI,
    'Controle de Equipamentos TI',
  )

  const allModules = [
    solicitacoesModule,
    configModule,
    fleetModule,
    refusalModule,
    equipmentsModule,
  ]

  const adminGroup = await prisma.accessGroup.upsert({
    where: { name: 'Administradores' },
    update: {},
    create: { name: 'Administradores', notes: 'Acesso total ao sistema' },
  })

  for (const mod of allModules) {
    await prisma.accessGroupGrant.upsert({
      where: { groupId_moduleId: { groupId: adminGroup.id, moduleId: mod.id } },
      update: { actions: ALL_ACTIONS },
      create: { groupId: adminGroup.id, moduleId: mod.id, actions: ALL_ACTIONS },
    })
  }

  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: superAdminUser.id, groupId: adminGroup.id } },
    update: {},
    create: { userId: superAdminUser.id, groupId: adminGroup.id, role: 'MANAGER' },
  })

  for (const mod of allModules) {
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

  await prisma.accessGroupGrant.upsert({
    where: { groupId_moduleId: { groupId: tiGroup.id, moduleId: configModule.id } },
    update: { actions: ['VIEW', 'CREATE', 'UPDATE'] },
    create: { groupId: tiGroup.id, moduleId: configModule.id, actions: ['VIEW', 'CREATE', 'UPDATE'] },
  })

  const rq063ApproversGroup = await prisma.accessGroup.upsert({
    where: { name: 'Aprovadores RQ_063' },
    update: {},
    create: { name: 'Aprovadores RQ_063', notes: 'Gestores que podem aprovar a RQ_063' },
  })

  await prisma.accessGroupGrant.upsert({
    where: { groupId_moduleId: { groupId: rq063ApproversGroup.id, moduleId: solicitacoesModule.id } },
    update: { actions: ['VIEW', 'APPROVE'] },
    create: { groupId: rq063ApproversGroup.id, moduleId: solicitacoesModule.id, actions: ['VIEW', 'APPROVE'] },
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
  /* =========================
     FEATURES E GRANTS POR FEATURE
     ========================= */
  type ModuleFeatures = { moduleId: string; moduleKey: string; items: { key: string; name: string }[] }

  const featureCatalog: ModuleFeatures[] = [
    {
      moduleId: configModule.id,
      moduleKey: MODULE_KEYS.CONFIGURACOES,
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
      moduleKey: MODULE_KEYS.SOLICITACOES,
      items: [
        { key: FEATURE_KEYS.SOLICITACOES.ENVIADAS, name: 'Solicitações Enviadas' },
        { key: FEATURE_KEYS.SOLICITACOES.RECEBIDAS, name: 'Solicitações Recebidas' },
        { key: FEATURE_KEYS.SOLICITACOES.APROVACAO, name: 'Aprovação de Solicitações' },
        { key: FEATURE_KEYS.SOLICITACOES.CADASTROS, name: 'Cadastros' },
      ],
    },
    {
      moduleId: fleetModule.id,
      moduleKey: MODULE_KEYS.FROTAS,
      items: [
        { key: FEATURE_KEYS.FROTAS.VEICULOS, name: 'Veículos' },
        { key: FEATURE_KEYS.FROTAS.CHECKINS, name: 'Check-ins' },
        { key: FEATURE_KEYS.FROTAS.DESLOCAMENTO_CHECKIN, name: 'Check-in de deslocamento' },
        { key: FEATURE_KEYS.FROTAS.DESLOCAMENTO_PAINEL, name: 'Painel de deslocamento' },
      ],
    },
    {
      moduleId: refusalModule.id,
      moduleKey: MODULE_KEYS.RECUSA,
      items: [
        { key: FEATURE_KEYS.RECUSA.PAINEL, name: 'Painel de Direito de Recusa' },
        { key: FEATURE_KEYS.RECUSA.MINHAS, name: 'Minhas recusas' },
        { key: FEATURE_KEYS.RECUSA.NOVA, name: 'Registrar recusa' },
        { key: FEATURE_KEYS.RECUSA.PENDENTES, name: 'Pendentes para avaliar' },
      ],
    },
    {
      moduleId: equipmentsModule.id,
      moduleKey: MODULE_KEYS.EQUIPAMENTOS_TI,
      items: [
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
  ]

  const createdFeatures: { id: string; key: string; moduleKey: string }[] = []

  for (const catalog of featureCatalog) {
    for (const item of catalog.items) {
      const feature = await prisma.moduleFeature.upsert({
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

      createdFeatures.push({ id: feature.id, key: feature.key, moduleKey: catalog.moduleKey })
    }
  }

  for (const feature of createdFeatures) {
    await prisma.featureGrant.upsert({
      where: { groupId_featureId: { groupId: adminGroup.id, featureId: feature.id } },
      update: { actions: ALL_ACTIONS },
      create: { groupId: adminGroup.id, featureId: feature.id, actions: ALL_ACTIONS },
    })
  }

  const tiActions = (moduleKey: string) => {
    if (moduleKey === MODULE_KEYS.CONFIGURACOES) {
      return ['VIEW', 'CREATE', 'UPDATE'] as Action[]
    }
    if (moduleKey === MODULE_KEYS.EQUIPAMENTOS_TI) {
      return ['VIEW', 'CREATE', 'UPDATE', 'DELETE'] as Action[]
    }
    return ['VIEW'] as Action[]
  }

  for (const feature of createdFeatures) {
    await prisma.featureGrant.upsert({
      where: { groupId_featureId: { groupId: tiGroup.id, featureId: feature.id } },
      update: { actions: tiActions(feature.moduleKey) },
      create: { groupId: tiGroup.id, featureId: feature.id, actions: tiActions(feature.moduleKey) },
    })
  }



  console.log('🎉 Seed concluído com sucesso!')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ Erro ao executar seed:', e)
  process.exit(1)
})
