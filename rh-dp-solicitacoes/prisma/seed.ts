// prisma/seed.ts
import { PrismaClient, Role, UserStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Usuário admin no seu banco de aplicação (NÃO cria no Supabase Auth)
  await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      // novos campos obrigatórios no seu schema
      login: 'admin',
      fullName: 'Administrador do Sistema',
      email: 'admin@empresa.com',

      // opcionais / conforme seu schema
      phone: '+55 31 99999-9999',
      costCenter: 'CC-0001',
      status: UserStatus.ATIVO,
      role: Role.ADMIN,
      passwordExpiresAt: new Date('2026-12-31T23:59:59Z'),
      // authId:  // (deixa vazio; será preenchido via trigger ou /api/session/sync)
    },
  })

  // (opcional) já criar alguns tipos de solicitação
  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Atualização cadastral' },
    update: {},
    create: {
      nome: 'Atualização cadastral',
      descricao: 'Alteração de dados pessoais/funcionais',
      schemaJson: { campos: [{ name: 'novoEndereco', type: 'text', label: 'Novo endereço' }] },
    },
  })

  await prisma.tipoSolicitacao.upsert({
    where: { nome: 'Vale-transporte' },
    update: {},
    create: {
      nome: 'Vale-transporte',
      descricao: 'Inclusão/alteração de rotas',
      schemaJson: { campos: [{ name: 'linha', type: 'text', label: 'Linha de ônibus' }] },
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('Seed concluído.')
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
