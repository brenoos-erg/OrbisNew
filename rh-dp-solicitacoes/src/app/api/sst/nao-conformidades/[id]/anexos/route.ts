import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'

async function saveFile(file: File, folder: string) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || '.bin'
  const fileName = `${randomUUID()}${ext}`
  const relPath = `/uploads/${folder}/${fileName}`
  const absPath = path.join(process.cwd(), 'public', relPath)
  await mkdir(path.dirname(absPath), { recursive: true })
  await writeFile(absPath, bytes)
  return relPath
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    if (!hasMinLevel(normalizeSstLevel(levels), ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nonConformityId = (await params).id
    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)

    const created = []
    for (const file of files) {
      const url = await saveFile(file, 'sst-nao-conformidades')
      const row = await prisma.nonConformityAttachment.create({
        data: {
          nonConformityId,
          filename: file.name,
          url,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          createdById: me.id,
        },
      })
      created.push(row)
    }

    await prisma.nonConformityTimeline.create({
      data: {
        nonConformityId,
        actorId: me.id,
        tipo: 'ANEXO',
        message: `${created.length} anexo(s) enviado(s)`,
      },
    })

    return NextResponse.json({ items: created })
  } catch (error) {
    console.error('POST /api/sst/nao-conformidades/[id]/anexos error', error)
   return NextResponse.json({ error: 'Erro ao enviar anexos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireActiveUser()
    const body = await req.json().catch(() => null)
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []

    const rows = await prisma.nonConformityAttachment.findMany({ where: { id: { in: ids } } })
    await prisma.nonConformityAttachment.deleteMany({ where: { id: { in: ids } } })
    for (const row of rows) {
      try {
        await unlink(path.join(process.cwd(), 'public', row.url))
      } catch {
        // noop
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/sst/nao-conformidades/[id]/anexos error', error)
    return NextResponse.json({ error: 'Erro ao excluir anexos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}