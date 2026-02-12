import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'

async function saveFile(file: File, folder: string) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || '.bin'
  const name = `${randomUUID()}${ext}`
  const relPath = `/uploads/${folder}/${name}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, bytes)
  return relPath
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireActiveUser()
  const form = await req.formData()
  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  const created = []
  for (const file of files) {
    const url = await saveFile(file, 'solicitacoes')
    const row = await prisma.attachment.create({ data: { id: randomUUID(), solicitationId: (await params).id, filename: file.name, url, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size } })
    created.push(row)
  }
  return NextResponse.json({ items: created })
}

export async function DELETE(req: NextRequest) {
  await requireActiveUser()
  const body = await req.json().catch(() => null)
  const ids: string[] = body?.ids ?? []
  const rows = await prisma.attachment.findMany({ where: { id: { in: ids } } })
  await prisma.attachment.deleteMany({ where: { id: { in: ids } } })
  for (const row of rows) {
    try { await unlink(path.join(process.cwd(), 'public', row.url)) } catch {}
  }
  return NextResponse.json({ ok: true })
}