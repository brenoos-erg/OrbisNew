// Importa o PrismaClient gerado pelo Prisma
import { PrismaClient } from '@prisma/client'


// Evita múltiplas instâncias em desenvolvimento (hot reload do Next)
const globalForPrisma = global as unknown as { prisma?: PrismaClient }


// Reaproveita a instância se existir, senão cria uma nova
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
log: ['query', 'error', 'warn'] // habilita logs úteis no dev
})


// Em dev, salva a instância no escopo global
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma