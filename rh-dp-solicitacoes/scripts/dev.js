const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { spawnSync, spawn } = require("child_process");

const commonOptions = {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
};

const DEFAULT_MYSQL_DATABASE_URL = "mysql://orbis:orbis123@localhost:3306/orbis";
const PRISMA_GENERATE_RETRIES = 3;

const skipMigrations = process.env.SKIP_PRISMA_MIGRATE === "true";
const skipSeed = process.env.SKIP_PRISMA_SEED === "true";

function runPrismaGenerateWithRetry() {
  for (let attempt = 1; attempt <= PRISMA_GENERATE_RETRIES; attempt++) {
    const result = spawnSync("npx", ["prisma", "generate"], commonOptions);

    if (result.status === 0) {
      return true;
    }

    if (attempt < PRISMA_GENERATE_RETRIES) {
      console.warn(`\n⚠️  Prisma generate failed (attempt ${attempt}/${PRISMA_GENERATE_RETRIES}). Retrying...`);
    }
  }

  console.warn(
    "\n⚠️  Prisma generate failed after retries. The dev server will still start, but generated Prisma client artifacts may be stale."
  );
  return false;
}

function clearStaleNextLock() {
  const lockPath = path.resolve(__dirname, "..", ".next", "dev", "lock");

  if (!fs.existsSync(lockPath)) {
    return;
  }

  try {
    fs.unlinkSync(lockPath);
    console.log(`Removed stale Next.js dev lock file at: ${lockPath}`);
  } catch {
    console.warn(
      "⚠️  Found an existing .next/dev/lock file but could not remove it. If dev startup fails, stop other next dev instances and delete the lock file manually."
    );
  }
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_MYSQL_DATABASE_URL;
  console.log(`DATABASE_URL não definido. Usando padrão local: ${DEFAULT_MYSQL_DATABASE_URL}`);
}

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl) {
  console.warn("\n⚠️  DATABASE_URL não definido: pulando prisma migrate/db push e seed no ambiente local.");
} else if (skipMigrations) {
  console.log("SKIP_PRISMA_MIGRATE=true: skipping prisma migrate and running prisma db push for local schema sync.");
   const dbPushResult = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], commonOptions);

  if (dbPushResult.status !== 0) {
    console.warn("\n⚠️  Prisma db push failed. The dev server will still start, but database operations may not work.");
  }
} else {
  const migrateResult = spawnSync("npx", ["prisma", "migrate", "deploy"], commonOptions);

  if (migrateResult.status !== 0) {
    console.warn("\n⚠️  Prisma migrations failed. The dev server will still start, but database operations may not work.");
    console.warn(
      "Set SKIP_PRISMA_MIGRATE=true to skip the migration step when running locally without a database connection."
    );
  }
}
if (!hasDatabaseUrl) {
  console.log("Skipping Prisma seed because DATABASE_URL is not configured.");
} else if (skipSeed) {
  console.log("Skipping Prisma seed because SKIP_PRISMA_SEED=true.");
} else {
  const seedResult = spawnSync("npx", ["prisma", "db", "seed"], commonOptions);

  if (seedResult.status !== 0) {
    console.warn("\n⚠️  Prisma seed failed. The dev server will still start, but initial data may be missing.");
    console.warn(
      "Set SKIP_PRISMA_SEED=true to skip the seeding step when running locally without a database connection."
    );
  }
}

if (hasDatabaseUrl) {
  runPrismaGenerateWithRetry();
}

clearStaleNextLock();

const devProcess = spawn("npx", ["next", "dev"], commonOptions);

devProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});