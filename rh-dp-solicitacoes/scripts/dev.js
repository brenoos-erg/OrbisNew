const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
const { spawnSync, spawn } = require('child_process')

const commonOptions = {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
}

const DEFAULT_MYSQL_DATABASE_URL = 'mysql://orbis:orbis123@localhost:3306/orbis'
const PRISMA_SCHEMA = path.resolve(__dirname, '..', 'prisma', 'schema.prisma')

const skipMigrations = process.env.SKIP_PRISMA_MIGRATE === 'true'
const skipSeed = process.env.SKIP_PRISMA_SEED === 'true'
const skipPrismaGenerate = process.env.SKIP_PRISMA_GENERATE === 'true'

function runPrismaGenerateOnce() {
  const result = spawnSync('npx', ['prisma', 'generate', '--schema', PRISMA_SCHEMA], commonOptions)

  if (result.status === 0) {
    return true
  }

  const isWindows = process.platform === 'win32'
  if (isWindows) {
    console.warn('\n⚠️  Prisma generate falhou no Windows (possível EPERM no query_engine).')
    console.warn('   1) Feche o servidor dev e qualquer processo node.exe/TS Server do VSCode.')
    console.warn('   2) Remova node_modules\\.prisma e rode: npx prisma generate')
    console.warn('   3) Se persistir, adicione exclusão do diretório no Windows Defender/antivírus.')
  } else {
    console.warn('\n⚠️  Prisma generate falhou. O servidor dev será iniciado com o client atual.')
  }

  return false
}

function clearStaleNextLock() {
  const lockPath = path.resolve(__dirname, '..', '.next', 'dev', 'lock')

  if (!fs.existsSync(lockPath)) {
    return
  }

  try {
    fs.unlinkSync(lockPath)
    console.log(`Removed stale Next.js dev lock file at: ${lockPath}`)
  } catch {
    console.warn(
      '⚠️  Found an existing .next/dev/lock file but could not remove it. If dev startup fails, stop other next dev instances and delete the lock file manually.',
    )
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_MYSQL_DATABASE_URL
  console.log(`DATABASE_URL não definido. Usando padrão local: ${DEFAULT_MYSQL_DATABASE_URL}`)
}

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)

if (!hasDatabaseUrl) {
  console.warn('\n⚠️  DATABASE_URL não definido: pulando prisma migrate/db push e seed no ambiente local.')
} else if (skipMigrations) {
  console.log('SKIP_PRISMA_MIGRATE=true: skipping prisma migrate and running prisma db push for local schema sync.')
  const dbPushResult = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--schema', PRISMA_SCHEMA], commonOptions)

  if (dbPushResult.status !== 0) {
    console.warn('\n⚠️  Prisma db push failed. The dev server will still start, but database operations may not work.')
  }
} else {
  const migrateResult = spawnSync('npx', ['prisma', 'migrate', 'deploy', '--schema', PRISMA_SCHEMA], commonOptions)

  if (migrateResult.status !== 0) {
    console.warn('\n⚠️  Prisma migrations failed. The dev server will still start, but database operations may not work.')
    console.warn(
      'Set SKIP_PRISMA_MIGRATE=true to skip the migration step when running locally without a database connection.',
    )
  }
}

if (!hasDatabaseUrl) {
  console.log('Skipping Prisma seed because DATABASE_URL is not configured.')
} else if (skipSeed) {
  console.log('Skipping Prisma seed because SKIP_PRISMA_SEED=true.')
} else {
  const seedResult = spawnSync('npx', ['prisma', 'db', 'seed', '--schema', PRISMA_SCHEMA], commonOptions)

  if (seedResult.status !== 0) {
    console.warn('\n⚠️  Prisma seed failed. The dev server will still start, but initial data may be missing.')
    console.warn('Set SKIP_PRISMA_SEED=true to skip the seeding step when running locally without a database connection.')
  }
}

if (hasDatabaseUrl && !skipPrismaGenerate) {
  runPrismaGenerateOnce()
}

clearStaleNextLock()

const devProcess = spawn('npx', ['next', 'dev', '--webpack'], commonOptions)

devProcess.on('exit', (code) => {
  process.exit(code ?? 0)
})