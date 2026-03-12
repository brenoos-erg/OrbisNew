import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { resolveTipoApproverId } from '@/lib/solicitationTipoApprovers'
import { isSolicitacaoEpiUniforme } from '@/lib/solicitationTypes'
import { canViewSensitiveHiringRequest, getUserDepartmentIds } from '@/lib/sensitiveHiringRequests'

async function ensureSensitiveHiringAccess(solicitationId: string, user: { id: string; role: 'COLABORADOR' | 'RH' | 'DP' | 'ADMIN'; departmentId?: string | null }) {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: solicitationId },
    select: {
      solicitanteId: true,
      assumidaPorId: true,
      approverId: true,
      departmentId: true,
      tipo: { select: { id: true, codigo: true, nome: true } },
    },
  })

  if (!solicitation) {
    return { ok: false as const, status: 404, error: 'Solicitação não encontrada.' }
  }

  const userDepartmentIds = await getUserDepartmentIds(user.id, user.departmentId)
  const canView = canViewSensitiveHiringRequest({
    user,
    solicitation,
    isResponsibleDepartmentMember: userDepartmentIds.includes(solicitation.departmentId),
  })

  if (!canView) {
    return { ok: false as const, status: 403, error: 'Você não possui permissão para acessar anexos desta solicitação.' }
  }

  return { ok: true as const }
}
async function encaminharEpiParaAprovacaoComAnexo(solicitationId: string, actorId: string) {
  const solicitation = await prisma.solicitation.findUnique({
    where: { id: solicitationId },
    include: {
      anexos: { select: { id: true } },
      tipo: true,
      department: { select: { code: true } },
    },
  })

  const isSstEpiFlow =
    Boolean(solicitation) &&
    isSolicitacaoEpiUniforme(solicitation?.tipo) &&
    solicitation?.department?.code === '19' &&
    solicitation.approvalStatus === 'NAO_PRECISA' &&
    solicitation.requiresApproval === false

  if (!isSstEpiFlow) return { changed: false }
  if ((solicitation?.anexos?.length ?? 0) === 0) {
    return { changed: false, error: 'Anexe ao menos um documento antes de encaminhar para aprovação.' }
  }

  const approverId = await resolveTipoApproverId(solicitation?.tipoId ?? '')
  if (!approverId) {
    return { changed: false, error: 'Não existe aprovador configurado para este tipo de solicitação.' }
  }

  await prisma.solicitation.update({
    where: { id: solicitationId },
    data: { requiresApproval: true, approvalStatus: 'PENDENTE', approverId, status: 'AGUARDANDO_APROVACAO' },
  })

  await prisma.event.create({
    data: { id: randomUUID(), solicitationId, actorId, tipo: 'AGUARDANDO_APROVACAO_GESTOR' },
  })

  await prisma.solicitationTimeline.create({
    data: {
      solicitationId,
      status: 'AGUARDANDO_APROVACAO',
      message: 'Documento anexado pelo SST. Solicitação encaminhada para aprovação nível 3.',
    },
  })

  return { changed: true }
}

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
  const me = await requireActiveUser()
  const solicitationId = (await params).id
  const access = await ensureSensitiveHiringAccess(solicitationId, me as any)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const form = await req.formData()
  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  const created = []
  for (const file of files) {
    const url = await saveFile(file, 'solicitacoes')
    const row = await prisma.attachment.create({ data: { id: randomUUID(), solicitationId, filename: file.name, url, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size } })
    created.push(row)
  }

  if (created.length > 0) {
    const result = await encaminharEpiParaAprovacaoComAnexo(solicitationId, me.id)
   if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ items: created })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveUser()
  const solicitationId = (await params).id

  const access = await ensureSensitiveHiringAccess(solicitationId, me as any)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const result = await encaminharEpiParaAprovacaoComAnexo(solicitationId, me.id)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })

  if (!result.changed) {
    return NextResponse.json({ error: 'Solicitação não está elegível para encaminhamento à aprovação.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const me = await requireActiveUser()
  const body = await req.json().catch(() => null)
  const ids: string[] = body?.ids ?? []
  const rows = await prisma.attachment.findMany({ where: { id: { in: ids } } })

  for (const row of rows) {
    const access = await ensureSensitiveHiringAccess(row.solicitationId, me as any)
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  }
  await prisma.attachment.deleteMany({ where: { id: { in: ids } } })
  for (const row of rows) {
    try { await unlink(path.join(process.cwd(), 'public', row.url)) } catch {}
  }
  return NextResponse.json({ ok: true })
}