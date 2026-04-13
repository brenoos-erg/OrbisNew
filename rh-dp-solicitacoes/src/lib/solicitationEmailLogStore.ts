import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export type EmailLogStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'TEST'

export type SolicitationEmailLogEntry = {
  id: string
  createdAt: string
  solicitationId?: string | null
  typeId?: string | null
  event: string
  recipients: string[]
  status: EmailLogStatus
  templateKey?: string | null
  subject?: string | null
  error?: string | null
  metadata?: Record<string, unknown>
}

const DB_FILE = path.join(process.cwd(), 'data', 'solicitation-email-log.json')

async function ensureDb() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true })
  try {
    await fs.access(DB_FILE)
  } catch {
    await fs.writeFile(DB_FILE, '[]', 'utf8')
  }
}

export async function readSolicitationEmailLogs() {
  await ensureDb()
  const raw = await fs.readFile(DB_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  const rows = Array.isArray(parsed) ? (parsed as SolicitationEmailLogEntry[]) : []
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

async function writeLogs(rows: SolicitationEmailLogEntry[]) {
  await ensureDb()
  await fs.writeFile(DB_FILE, JSON.stringify(rows, null, 2), 'utf8')
}

export async function appendSolicitationEmailLog(
  input: Omit<SolicitationEmailLogEntry, 'id' | 'createdAt'>,
) {
  const rows = await readSolicitationEmailLogs()
  const entry: SolicitationEmailLogEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    recipients: Array.from(new Set((input.recipients ?? []).map((item) => item.trim()).filter(Boolean))),
    error: input.error ?? null,
    subject: input.subject ?? null,
    templateKey: input.templateKey ?? null,
    solicitationId: input.solicitationId ?? null,
    typeId: input.typeId ?? null,
  }

  await writeLogs([entry, ...rows].slice(0, 1500))
  return entry
}
