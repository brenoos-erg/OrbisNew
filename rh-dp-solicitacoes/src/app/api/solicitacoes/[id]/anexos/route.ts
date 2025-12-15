import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSupabaseServerClient } from '@/lib/supabase'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ATTACHMENTS_BUCKET =
  process.env.SUPABASE_ATTACHMENTS_BUCKET || 'attachments'

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
  const { data: bucket, error } = await supabase.storage.getBucket(
    ATTACHMENTS_BUCKET,
  )

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

  const { error: createError } = await supabase.storage.createBucket(
    ATTACHMENTS_BUCKET,
    { public: true },
  )

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
    await requireActiveUser()

    const solicitationId = params.id
    const form = await req.formData()
    const files = form.getAll('files') as File[]

    if (!files || files.length === 0) {
      throw new HttpError(400, 'Envie ao menos um arquivo.')
    }

    await ensureAttachmentsBucket()

    const createdAttachments: Prisma.AttachmentCreateManyInput[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      if (file.size > MAX_SIZE) {
        throw new HttpError(413, 'Arquivo muito grande (máx. 10 MB).')
      }

      if (!ALLOWED_MIME_PREFIXES.some(prefix => file.type.startsWith(prefix))) {
        throw new HttpError(400, 'Tipo de arquivo não permitido.')
      }

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `solicitation-${solicitationId}/${randomUUID()}.${ext}`

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

      const { data } = supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .getPublicUrl(path)

      const publicUrl = data?.publicUrl
      if (!publicUrl) {
        throw new HttpError(500, 'Não foi possível obter a URL do arquivo.')
      }

      const attachment: Prisma.AttachmentCreateManyInput = {
        id: randomUUID(),
        solicitationId,
        filename: file.name,
        url: publicUrl,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        createdAt: new Date(),
      }

      createdAttachments.push(attachment)
    }

    if (createdAttachments.length === 0) {
      throw new HttpError(400, 'Nenhum arquivo válido enviado.')
    }

    await prisma.attachment.createMany({ data: createdAttachments })

    return NextResponse.json({ anexos: createdAttachments })
  } catch (err) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove(uploadedPaths)

      if (cleanupError) {
        console.error(
          'Erro ao limpar uploads após falha na criação de anexos',
          cleanupError,
        )
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

    console.error('❌ POST /api/solicitacoes/[id]/anexos error', err)
    return NextResponse.json({ error: 'Erro ao enviar arquivo(s).' }, { status: 500 })
  }
}