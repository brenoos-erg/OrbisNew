export const dynamic = 'force-dynamic'
export const revalidate = 0

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireActiveUser } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { ModuleLevel } from '@prisma/client'
import { getUserModuleContext } from '@/lib/moduleAccess'


const ATTACHMENTS_BUCKET = process.env.SUPABASE_ATTACHMENTS_BUCKET || 'attachments'
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf']

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function ensureAttachmentsBucket() {
  const supabase = getSupabaseServerClient()
  const { data: bucket, error } = await supabase.storage.getBucket(ATTACHMENTS_BUCKET)

  if (bucket) return

  if (error) {
    const rawStatusCode =
      (error as { statusCode?: number | string }).statusCode ??
      (error as { status?: number | string }).status

    const statusCode =
      typeof rawStatusCode === 'string'
        ? Number.parseInt(rawStatusCode, 10)
        : typeof rawStatusCode === 'number'
          ? rawStatusCode
          : undefined

    if (statusCode !== 404) {
      throw error
    }
  }

  const { error: createError } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET, {
    public: true,
  })

  if (createError) {
    throw createError
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const uploadedPaths: string[] = []
  const supabase = getSupabaseServerClient()

  try {
    const me = await requireActiveUser()
    const { levels } = await getUserModuleContext(me.id)
    const moduleLevel = levels['direito-de-recusa'] ?? levels['direito_de_recusa']

    if (!moduleLevel) {
      throw new HttpError(403, 'Usuário não possui acesso a este módulo.')
    }

    const report = await prisma.refusalReport.findUnique({
      where: { id: params.id },
      select: { id: true, employeeId: true },
    })

    if (!report) {
      throw new HttpError(404, 'Registro não encontrado.')
    }

    const order: ModuleLevel[] = ['NIVEL_1', 'NIVEL_2', 'NIVEL_3']
    const isReviewer = order.indexOf(moduleLevel) >= order.indexOf(ModuleLevel.NIVEL_2)
    if (!isReviewer && report.employeeId !== me.id) {
      throw new HttpError(403, 'Usuário não possui permissão para anexar arquivos.')
    }

    const form = await req.formData()
    const files = form.getAll('files') as File[]

    if (!files || files.length === 0) {
      throw new HttpError(400, 'Envie ao menos um arquivo.')
    }

    await ensureAttachmentsBucket()

    const created: Prisma.RefusalAttachmentCreateManyInput[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      if (file.size > MAX_SIZE) {
        throw new HttpError(413, 'Arquivo muito grande (máx. 10 MB).')
      }

      if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
        throw new HttpError(400, 'Tipo de arquivo não permitido.')
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `refusal-report-${params.id}/${randomUUID()}.${ext}`

      const upload = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })

      if (upload.error) {
        console.error('Erro ao enviar arquivo para storage', upload.error)
        throw new HttpError(500, 'Não foi possível salvar o arquivo.')
      }

      uploadedPaths.push(path)

      const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path)
      const publicUrl = data?.publicUrl
      if (!publicUrl) {
        throw new HttpError(500, 'Não foi possível obter a URL do arquivo.')
      }

      const attachment: Prisma.RefusalAttachmentCreateManyInput = {
        id: randomUUID(),
        reportId: params.id,
        filename: file.name,
        url: publicUrl,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        createdAt: new Date(),
      }

      created.push(attachment)
    }

    if (created.length === 0) {
      throw new HttpError(400, 'Nenhum arquivo válido enviado.')
    }

    await prisma.refusalAttachment.createMany({ data: created })

    return NextResponse.json({ anexos: created })
  } catch (err) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove(uploadedPaths)

      if (cleanupError) {
        console.error('Erro ao limpar uploads após falha na criação de anexos', cleanupError)
      }
    }

    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    const message = err instanceof Error ? err.message : 'Erro ao enviar arquivo(s).'
    if (message === 'Usuário não autenticado') {
      return NextResponse.json({ error: message }, { status: 401 })
    }

    if (message === 'Usuário inativo') {
      return NextResponse.json({ error: message }, { status: 403 })
    }

    console.error('❌ POST /api/direito-de-recusa/[id]/anexos error', err)
    return NextResponse.json({ error: 'Erro ao enviar arquivo(s).' }, { status: 500 })
  }
}
