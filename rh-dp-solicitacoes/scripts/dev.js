require("dotenv").config();
const { spawnSync, spawn } = require("child_process");

const commonOptions = {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
};

const skipMigrations = process.env.SKIP_PRISMA_MIGRATE === "true";
const skipSeed = process.env.SKIP_PRISMA_SEED === "true";

if (skipMigrations) {
  console.log("Skipping Prisma migrations because SKIP_PRISMA_MIGRATE=true.");
} else {
  const migrateResult = spawnSync("npx", ["prisma", "migrate", "deploy"], commonOptions);

  if (migrateResult.status !== 0) {
    console.warn("\n⚠️  Prisma migrations failed. The dev server will still start, but database operations may not work.");
    console.warn(
      "Set SKIP_PRISMA_MIGRATE=true to skip the migration step when running locally without a database connection."
    );
  }
}
if (skipSeed) {
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


const devProcess = spawn("npx", ["next", "dev"], commonOptions);

devProcess.on("exit", (code) => {
  process.exit(code ?? 0);
});