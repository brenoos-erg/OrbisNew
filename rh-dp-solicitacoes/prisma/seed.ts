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
     TIPOS DE SOLICITAÇÃO
     ========================= */
  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Atualização cadastral' },
    update: {},
    create: {
      id: randomUUID(),
      nome: 'Atualização cadastral',
      descricao: 'Alteração de dados pessoais/funcionais',
      schemaJson: {
        campos: [{ name: 'novoEndereco', type: 'text', label: 'Novo endereço' }],
      },
      updatedAt: new Date(),
    },
  })

  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Vale-transporte' },
    update: {},
    create: {
      id: randomUUID(),
      nome: 'Vale-transporte',
      descricao: 'Inclusão/alteração de rotas',
      schemaJson: {
        campos: [{ name: 'linha', type: 'text', label: 'Linha de ônibus' }],
      },
      updatedAt: new Date(),
    },
  })
  console.log('✅ Tipos de solicitação criados.')

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
