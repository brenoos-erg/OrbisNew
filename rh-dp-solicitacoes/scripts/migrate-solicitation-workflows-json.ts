import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createWorkflowRow, readWorkflowRows, type WorkflowDraft } from '@/lib/solicitationWorkflowsStore'

async function main() {
  const file = path.join(process.cwd(), 'data', 'solicitation-workflows.json')
  const raw = await fs.readFile(file, 'utf8').catch(() => null)
  if (!raw) { console.info('Arquivo data/solicitation-workflows.json não encontrado; nada a migrar.'); return }
  const rows = JSON.parse(raw) as WorkflowDraft[]
  const existing = await readWorkflowRows()
  const existingIds = new Set(existing.map((x) => x.id).filter(Boolean))
  for (const row of rows) {
    if (row.id && existingIds.has(row.id)) continue
    await createWorkflowRow(row, { action: 'IMPORT_JSON' })
    console.info(`Workflow migrado: ${row.name} (${row.tipoId})`)
  }
}
main().catch((error) => { console.error(error); process.exit(1) })
