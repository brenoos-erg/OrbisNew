import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const me = await requireActiveUser()
  const form = await req.formData()
  const file = form.get('file')
  const scope = String(req.nextUrl.searchParams.get('scope') ?? 'general').replace(/[^a-z0-9-]/gi, '')

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', scope)
  await fs.mkdir(uploadDir, { recursive: true })
  const safeName = `${Date.now()}-${randomUUID()}-${file.name.replace(/\s+/g, '-')}`
  await fs.writeFile(path.join(uploadDir, safeName), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({
    url: `/uploads/${scope}/${safeName}`,
    originalName: file.name,
    uploadedAt: new Date().toISOString(),
    uploadedBy: me.fullName || me.email,
  })
}