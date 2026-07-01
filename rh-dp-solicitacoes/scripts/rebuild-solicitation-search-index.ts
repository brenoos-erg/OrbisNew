import { rebuildSolicitationSearchIndexBatch } from '../src/lib/solicitationSearchIndex'

async function main() {
  const apply = process.argv.includes('--apply')
  const all = process.argv.includes('--all')
  const cleanOrphans = process.argv.includes('--clean-orphans')
  const takeArg = process.argv.find((arg) => arg.startsWith('--take='))
  const take = takeArg ? Number(takeArg.split('=')[1]) || 500 : 500
  const result = await rebuildSolicitationSearchIndexBatch({ apply, take, all, cleanOrphans })
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...result }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
