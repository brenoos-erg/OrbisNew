import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { ModuleLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { devErrorDetail } from '@/lib/apiError'
import { requireActiveUser } from '@/lib/auth'
import { getUserModuleContext } from '@/lib/moduleAccess'
import { hasMinLevel, normalizeSstLevel } from '@/lib/sst/access'
import { appendNonConformityTimelineEvent } from '@/lib/sst/nonConformityTimeline'
import { canUserAccessNc, canUserTreatNc, getUserCostCenterIds } from '@/lib/sst/nonConformityAccess'
import { buildDocumentUploadPaths, normalizeStoredAttachmentUrl, resolveExistingAttachmentPath } from '@/lib/files/attachmentStorage'

async function saveFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = path.extname(file.name) || '.bin'
  const fileName = `${randomUUID()}${ext}`
  const { relativeUrl, absolutePath } = buildDocumentUploadPaths(fileName)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, bytes)
  return relativeUrl
}

async function getContext(userId: string) {
  const { levels } = await getUserModuleContext(userId)
  const level = normalizeSstLevel(levels)
  return { level }
}

async function getNcAccessContext(nonConformityId: string) {
  return prisma.nonConformity.findUnique({
    where: { id: nonConformityId },
    select: {
      solicitanteId: true,
      centroQueDetectouId: true,
      centroQueOriginouId: true,
    },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { level } = await getContext(me.id)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nonConformityId = (await params).id
    const nc = await getNcAccessContext(nonConformityId)
    if (!nc) {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }

    const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canAccess = canUserAccessNc({
      userId: me.id,
      level,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canAccess) {      return NextResponse.json({ error: 'Sem acesso à não conformidade.' }, { status: 403 })
    }

       const items = await prisma.nonConformityAttachment.findMany({
      where: { nonConformityId },
      include: { createdBy: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const safeItems = await Promise.all(
      items.map(async (item) => {
        const resolved = await resolveExistingAttachmentPath(item.url)
        return {
          ...item,
          url: resolved?.normalizedUrl ?? (() => {
            const normalized = normalizeStoredAttachmentUrl(item.url)
            const baseName = normalized ? path.posix.basename(normalized) : ''
            return baseName ? `/api/files/${encodeURIComponent(baseName)}` : item.url
          })(),
        }
      }),
    )

    return NextResponse.json({ items: safeItems })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao listar anexos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { level } = await getContext(me.id)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nonConformityId = (await params).id
    const nc = await getNcAccessContext(nonConformityId)
    if (!nc) {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }

    const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canTreat = canUserTreatNc({
      userId: me.id,
      level,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canTreat) {
      return NextResponse.json({ error: 'Sem acesso à não conformidade.' }, { status: 403 })
    }
    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)

   const created = []
    for (const file of files) {
      const url = await saveFile(file)
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

     await appendNonConformityTimelineEvent(prisma, {
      nonConformityId,
      actorId: me.id,
      tipo: 'ANEXO',
      message: `${created.length} anexo(s) enviado(s)`,
    })

    return NextResponse.json({ items: created })
  } catch (error) {
      return NextResponse.json({ error: 'Erro ao enviar anexos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireActiveUser()
    const { level } = await getContext(me.id)
    if (!hasMinLevel(level, ModuleLevel.NIVEL_1)) {
      return NextResponse.json({ error: 'Usuário não possui acesso ao módulo SST.' }, { status: 403 })
    }

    const nonConformityId = (await params).id
    const nc = await getNcAccessContext(nonConformityId)
    if (!nc) {
      return NextResponse.json({ error: 'Não conformidade não encontrada.' }, { status: 404 })
    }

    const userCostCenterIds = hasMinLevel(level, ModuleLevel.NIVEL_2) ? [] : await getUserCostCenterIds(me.id)
    const canTreat = canUserTreatNc({
      userId: me.id,
      level,
      ncSolicitanteId: nc.solicitanteId,
      centroQueDetectouId: nc.centroQueDetectouId,
      centroQueOriginouId: nc.centroQueOriginouId,
      userCostCenterIds,
    })
    if (!canTreat) {
      return NextResponse.json({ error: 'Sem acesso à não conformidade.' }, { status: 403 })
    }

     const body = await req.json().catch(() => null)
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    const rows = await prisma.nonConformityAttachment.findMany({ where: { id: { in: ids }, nonConformityId } })

    await prisma.nonConformityAttachment.deleteMany({ where: { id: { in: rows.map((x) => x.id) } } })
    for (const row of rows) {
      try {
        const resolved = await resolveExistingAttachmentPath(row.url)
        if (resolved) await unlink(resolved.absolutePath)
      } catch {
        // noop
      }
    }
     await prisma.nonConformityTimeline.create({
      data: {
        nonConformityId,
        actorId: me.id,
        tipo: 'ANEXO_EXCLUIDO',
        message: `${rows.length} anexo(s) removido(s)`,
      },
    })

     return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir anexos.', detail: devErrorDetail(error) }, { status: 500 })
  }
}