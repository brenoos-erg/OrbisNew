import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000'

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function isConnectionRefused(error) {
  return (
    error?.cause?.code === 'ECONNREFUSED'
    || error?.code === 'ECONNREFUSED'
    || error?.message?.includes('ECONNREFUSED')
  )
}

async function postJson(path, body) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    return { response, payload }
  } catch (error) {
    if (isConnectionRefused(error)) {
      throw new Error(
        `Não foi possível conectar em ${baseUrl}. Inicie a aplicação (ex.: npm run dev) e tente novamente.`,
        { cause: error },
      )
    }

    throw error
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('A variável DATABASE_URL é obrigatória para executar este script.')
  }

  const unique = randomUUID().slice(0, 8)
  const email = `first-access-${unique}@example.com`
  const login = `firstaccess${unique}`

  const created = await prisma.user.create({
    data: {
      fullName: `First Access ${unique}`,
      email,
      login,
      role: 'COLABORADOR',
      status: 'ATIVO',
      mustChangePassword: true,
      passwordHash: null,
    },
    select: { id: true },
  })

  try {
    const loginNoPassword = await postJson('/api/auth/login', {
      identifier: email.toUpperCase(),
      password: 'senha-qualquer',
    })
    assert.equal(loginNoPassword.response.status, 428)
    assert.equal(loginNoPassword.payload.reason, 'NO_PASSWORD')

    const requestedReset = await postJson('/api/auth/request-password-reset', {
      identifier: login.toUpperCase(),
      next: '/dashboard',
    })
    assert.equal(requestedReset.response.status, 200)

    const afterResetRequest = await prisma.user.findUnique({
      where: { id: created.id },
      select: { resetTokenHash: true, resetTokenExpiresAt: true },
    })
    assert.ok(afterResetRequest?.resetTokenHash)
    assert.ok(afterResetRequest?.resetTokenExpiresAt)

    const knownToken = `known-${unique}`
    await prisma.user.update({
      where: { id: created.id },
      data: {
        resetTokenHash: tokenHash(knownToken),
        resetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    const resetResult = await postJson('/api/auth/reset-password', {
      token: knownToken,
      password: 'NovaSenha@123',
    })
    assert.equal(resetResult.response.status, 200)

    const loginAfterReset = await postJson('/api/auth/login', {
      identifier: login,
      password: 'NovaSenha@123',
    })
    assert.equal(loginAfterReset.response.status, 200)
    assert.ok(loginAfterReset.response.headers.get('set-cookie')?.includes('app_auth='))

    console.info('Fluxo de primeiro acesso validado com sucesso.')
  } finally {
    await prisma.user.deleteMany({ where: { id: created.id } })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })