// prisma/seed.ts
import { PrismaClient, UserStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@empresa.com' },
    update: {},
    create: {
      login: 'admin',
      fullName: 'Administrador do Sistema',
      email: 'admin@empresa.com',
      phone: '+55 31 99999-9999',
      costCenter: 'CC-0001',
      status: UserStatus.ATIVO,
      // role removido
      // authId vazio (será preenchido no /api/session/sync)
    },
  })

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
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('✅ Seed concluído com sucesso.')
  })
  .catch(async (e) => {
    console.error('❌ Erro ao executar seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
