import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { supabase } from '@/lib/supabase'
import { requireActiveUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const ATTACHMENTS_BUCKET =
  process.env.SUPABASE_ATTACHMENTS_BUCKET || 'attachments'

async function ensureAttachmentsBucket() {
  const { data: bucket, error } = await supabase.storage.getBucket(
    ATTACHMENTS_BUCKET,
  )

  if (bucket) return

  if (error && error.statusCode !== 404) {
    throw error
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
  try {
    await requireActiveUser()

    const solicitationId = params.id
    const form = await req.formData()
    const files = form.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Envie ao menos um arquivo.' },
        { status: 400 },
      )
    }

    await ensureAttachmentsBucket()

    const createdAttachments: Prisma.AttachmentCreateManyInput[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `solicitation-${solicitationId}/${crypto.randomUUID()}.${ext}`

      const upload = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(path, buffer, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        })

      if (upload.error) {
        console.error('Erro ao enviar arquivo para storage', upload.error)
        return NextResponse.json(
          { error: 'Não foi possível salvar o arquivo.' },
          { status: 500 },
        )
      }

      const { data } = supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .getPublicUrl(path)

      const publicUrl = data?.publicUrl
      if (!publicUrl) {
        return NextResponse.json(
          { error: 'Não foi possível obter a URL do arquivo.' },
          { status: 500 },
        )
      }

      const attachment: Prisma.AttachmentCreateManyInput = {
        id: crypto.randomUUID(),
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
      return NextResponse.json(
        { error: 'Nenhum arquivo válido enviado.' },
        { status: 400 },
      )
    }

    await prisma.attachment.createMany({ data: createdAttachments })

    return NextResponse.json({ anexos: createdAttachments })
  } catch (err) {
    console.error('❌ POST /api/solicitacoes/[id]/anexos error', err)
    return NextResponse.json(
      { error: 'Erro ao enviar arquivo(s).' },
      { status: 500 },
    )
  }
}